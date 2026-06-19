"""
@file views.py
@description REST surface for the messaging domain. Role-scoped querysets (artist
             sees own threads; management sees the whole pool), thread/message
             creation delegated to MessagingService, and lightweight triage
             (assignee/status) for managers. List is unpaginated to mirror the
             notifications inbox and the 30s frontend polling model.
@architecture Enterprise SaaS 2026
@module messaging/views
"""
import logging
from uuid import UUID

from django.contrib.auth import get_user_model
from django.db.models import Count, F, OuterRef, Prefetch, Q, QuerySet, Subquery
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from core.constants import AppRole
from core.request_utils import request_user
from roster.models import Artist, Project

from .dtos import ThreadCreateDTO
from .models import (
    ChannelMembership,
    ChannelMessage,
    Message,
    ProjectChannel,
    Thread,
    ThreadContextType,
    ThreadReadState,
    ThreadStatus,
)
from .selectors import user_brief
from .serializers import (
    ChannelDetailSerializer,
    ChannelListSerializer,
    ChannelMessageCreateSerializer,
    ChannelMessageSerializer,
    ChannelPinSerializer,
    ChannelPushPrefSerializer,
    MessageCreateSerializer,
    MessageSerializer,
    ThreadCreateSerializer,
    ThreadDetailSerializer,
    ThreadListSerializer,
    ThreadUpdateSerializer,
)
from .services import ChannelService, MessagingService

logger = logging.getLogger(__name__)
User = get_user_model()

_MANAGER_FILTER = Q(profile__role=AppRole.MANAGER) | Q(is_staff=True)


class ThreadViewSet(viewsets.GenericViewSet):
    """
    Conversation endpoints. Router auto-generates the custom action routes:
      /threads/, /threads/{pk}/, /threads/{pk}/messages/, /threads/{pk}/read/,
      /threads/unread-count/, /threads/recipients/.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ThreadListSerializer
    pagination_class = None

    # ------------------------------------------------------------------ #
    # Scoping helpers                                                    #
    # ------------------------------------------------------------------ #

    def _is_manager(self, user) -> bool:
        role = getattr(getattr(user, 'profile', None), 'role', None)
        return role == AppRole.MANAGER or bool(getattr(user, 'is_staff', False))

    @staticmethod
    def _is_manager_user_id(user_id: int) -> bool:
        return User.objects.filter(_MANAGER_FILTER, id=user_id, is_active=True).exists()

    def get_queryset(self) -> QuerySet[Thread]:
        user = request_user(self.request)
        # Lean base queryset: scoping only. select_related is added by the read
        # actions that actually serialize related objects (list/retrieve), so it
        # never collides with .only()/.values() on the count path.
        qs = Thread.objects.all()

        if not self._is_manager(user):
            return qs.filter(artist__user_id=user.id)

        params = self.request.query_params
        assignee = params.get('assignee')
        if assignee == 'me':
            qs = qs.filter(assignee_id=user.id)
        elif assignee == 'unassigned':
            qs = qs.filter(assignee__isnull=True)
        if params.get('status'):
            qs = qs.filter(status=params['status'])
        if params.get('context_type'):
            qs = qs.filter(context_type=params['context_type'])
        return qs

    def _read_map(self, request: Request, thread_ids: list) -> dict:
        states = ThreadReadState.objects.filter(
            user_id=request_user(request).id, thread_id__in=thread_ids
        ).values_list('thread_id', 'last_read_at')
        return dict(states)

    # ------------------------------------------------------------------ #
    # Collection                                                         #
    # ------------------------------------------------------------------ #

    def list(self, request: Request) -> Response:
        last_msg = Message.objects.filter(thread=OuterRef('pk')).order_by('-created_at')
        threads = list(
            self.get_queryset()
            .select_related('artist', 'assignee', 'assignee__artist_profile')
            .annotate(last_body=Subquery(last_msg.values('body')[:1]))
        )
        read_map = self._read_map(request, [t.id for t in threads])
        serializer = ThreadListSerializer(threads, many=True, context={'request': request, 'read_map': read_map})
        return Response(serializer.data)

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        qs = self.get_queryset().select_related('artist', 'assignee', 'assignee__artist_profile').prefetch_related(
            Prefetch(
                'messages',
                queryset=Message.objects.select_related('sender', 'sender__artist_profile').order_by('created_at'),
            )
        )
        thread = get_object_or_404(qs, pk=pk)
        read_map = self._read_map(request, [thread.id])
        serializer = ThreadDetailSerializer(thread, context={'request': request, 'read_map': read_map})
        return Response(serializer.data)

    @staticmethod
    def _find_reusable_thread(
        *, artist: Artist, context_type: str, context_id: UUID | None, assignee_id: int | None
    ) -> Thread | None:
        """An OPEN conversation to continue instead of spawning a duplicate.

        - PROJECT-scoped: one thread per (artist, project) while open — keeps a person's
          private project matters in a single, resolvable place (and tagged to the project).
        - GENERAL + undirected: the artist's standing general thread.
        Directed general threads (an explicit assignee) always open fresh.
        """
        if context_type == ThreadContextType.PROJECT and context_id:
            return (
                Thread.objects.filter(
                    artist=artist,
                    context_type=ThreadContextType.PROJECT,
                    context_id=context_id,
                    status=ThreadStatus.OPEN,
                )
                .order_by('-last_message_at')
                .first()
            )
        if context_type == ThreadContextType.GENERAL and not context_id and not assignee_id:
            return (
                Thread.objects.filter(
                    artist=artist,
                    context_type=ThreadContextType.GENERAL,
                    status=ThreadStatus.OPEN,
                )
                .order_by('-last_message_at')
                .first()
            )
        return None

    def create(self, request: Request) -> Response:
        user = request_user(request)
        serializer = ThreadCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if self._is_manager(user):
            artist_id = data.get('artist_id')
            if not artist_id:
                return Response({"detail": "artist_id is required for management-initiated threads."}, status=status.HTTP_400_BAD_REQUEST)
            artist = Artist.objects.select_related('user').filter(id=artist_id, is_deleted=False).first()
            if artist is None:
                return Response({"detail": "Artist not found."}, status=status.HTTP_404_NOT_FOUND)
            if not artist.user_id:
                return Response({"detail": "Artist has no linked user account."}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
            assignee_id = data.get('assignee_id') or user.id
        else:
            artist = Artist.objects.filter(user_id=user.id, is_deleted=False).first()
            if artist is None:
                return Response({"detail": "No artist profile linked to this account."}, status=status.HTTP_403_FORBIDDEN)
            assignee_id = data.get('assignee_id')
            if assignee_id is not None and not self._is_manager_user_id(assignee_id):
                return Response({"detail": "Chosen recipient is not a manager."}, status=status.HTTP_400_BAD_REQUEST)

        context_type = data.get('context_type', ThreadContextType.GENERAL)
        context_id = data.get('context_id')

        # Continue an existing OPEN conversation instead of duplicating it: one thread
        # per (artist, project) for project matters, and the artist's standing general
        # thread for undirected questions (see _find_reusable_thread).
        existing = self._find_reusable_thread(
            artist=artist,
            context_type=context_type,
            context_id=context_id,
            assignee_id=assignee_id,
        )
        if existing is not None:
            MessagingService.post_message(thread=existing, sender_id=user.id, body=data['body'])
            read_map = {existing.id: existing.last_message_at}
            return Response(
                ThreadDetailSerializer(existing, context={'request': request, 'read_map': read_map}).data,
                status=status.HTTP_200_OK,
            )

        dto = ThreadCreateDTO(
            artist_id=artist.id,
            sender_id=user.id,
            subject=data['subject'],
            body=data['body'],
            context_type=context_type,
            context_id=context_id,
            assignee_id=assignee_id,
        )
        thread = MessagingService.create_thread(dto)
        read_map = {thread.id: thread.last_message_at}
        serializer_out = ThreadDetailSerializer(thread, context={'request': request, 'read_map': read_map})
        return Response(serializer_out.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        user = request_user(request)
        if not self._is_manager(user):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        thread = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = ThreadUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        update_fields: list[str] = []
        if 'assignee_id' in data:
            new_assignee = data['assignee_id']
            if new_assignee is not None and not self._is_manager_user_id(new_assignee):
                return Response({"detail": "Assignee must be a manager."}, status=status.HTTP_400_BAD_REQUEST)
            thread.assignee_id = new_assignee
            update_fields.append('assignee')
        if 'status' in data:
            thread.status = data['status']
            update_fields.append('status')
        if update_fields:
            update_fields.append('updated_at')
            thread.save(update_fields=update_fields)

        read_map = self._read_map(request, [thread.id])
        return Response(ThreadDetailSerializer(thread, context={'request': request, 'read_map': read_map}).data)

    # ------------------------------------------------------------------ #
    # Member actions                                                     #
    # ------------------------------------------------------------------ #

    @action(detail=True, methods=['post'], url_path='messages')
    def post_message(self, request: Request, pk: str | None = None) -> Response:
        user = request_user(request)
        thread = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = MessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = MessagingService.post_message(
            thread=thread, sender_id=user.id, body=serializer.validated_data['body']
        )
        return Response(MessageSerializer(message, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='read')
    def read(self, request: Request, pk: str | None = None) -> Response:
        user = request_user(request)
        thread = get_object_or_404(self.get_queryset(), pk=pk)
        MessagingService.mark_read(thread=thread, user_id=user.id)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request: Request) -> Response:
        rows = list(self.get_queryset().values_list('id', 'last_message_at'))
        read_map = self._read_map(request, [tid for tid, _ in rows])
        thread_unread = sum(
            1 for tid, last_message_at in rows
            if read_map.get(tid) is None or last_message_at > read_map[tid]
        )

        # Project channels count toward the same "unread conversations" badge.
        user = request_user(request)
        if self._is_manager(user):
            channels = ProjectChannel.objects.all()
        else:
            channels = ProjectChannel.objects.filter(
                memberships__user=user, memberships__is_deleted=False
            ).distinct()
        channel_rows = list(channels.values_list('id', 'last_message_at'))
        channel_read = dict(
            ChannelMembership.objects.filter(
                user=user, channel_id__in=[cid for cid, _ in channel_rows]
            ).values_list('channel_id', 'last_read_at')
        )
        channel_unread = 0
        for cid, last_message_at in channel_rows:
            if last_message_at is None:
                continue
            last_read = channel_read.get(cid)
            if last_read is None or last_message_at > last_read:
                channel_unread += 1

        return Response({"unread_count": thread_unread + channel_unread})

    @action(detail=False, methods=['get'], url_path='recipients')
    def recipients(self, request: Request) -> Response:
        user = request_user(request)
        managers = (
            User.objects.filter(_MANAGER_FILTER, is_active=True)
            .exclude(id=user.id)
            .select_related('artist_profile')
            .distinct()
        )
        return Response([user_brief(m) for m in managers])


class ProjectChannelViewSet(viewsets.GenericViewSet):
    """
    Project group channels. Managers see all channels; artists see channels where they
    hold an active membership (synced from confirmed participation). Delivery is in-app +
    opt-in push only — handled in ChannelService, not the notifications router.
    Router auto-generates: /channels/, /channels/{pk}/, /channels/{pk}/messages/,
    /channels/{pk}/read/, /channels/{pk}/membership/, /channels/{pk}/messages/{mid}/pin/,
    /channels/by-project/{projectId}/.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ChannelListSerializer
    pagination_class = None

    def _is_manager(self, user) -> bool:
        role = getattr(getattr(user, 'profile', None), 'role', None)
        return role == AppRole.MANAGER or bool(getattr(user, 'is_staff', False))

    def get_queryset(self) -> QuerySet[ProjectChannel]:
        user = request_user(self.request)
        qs = ProjectChannel.objects.select_related('project')
        if self._is_manager(user):
            return qs
        return qs.filter(memberships__user=user, memberships__is_deleted=False).distinct()

    def _read_map(self, request: Request, channel_ids: list) -> dict:
        states = ChannelMembership.objects.filter(
            user_id=request_user(request).id, channel_id__in=channel_ids
        ).values_list('channel_id', 'last_read_at')
        return dict(states)

    def _get_accessible(self, request: Request, pk: str | None) -> ProjectChannel | None:
        """Returns the channel if the user may access it (managers get a lazy membership row)."""
        user = request_user(request)
        channel = get_object_or_404(ProjectChannel.objects.select_related('project'), pk=pk)
        if self._is_manager(user):
            ChannelService.ensure_manager_membership(channel=channel, user=user)
            return channel
        is_member = ChannelMembership.objects.filter(channel=channel, user_id=user.id).exists()
        return channel if is_member else None

    def _detail_response(self, request: Request, channel: ProjectChannel) -> Response:
        hydrated = (
            ProjectChannel.objects.select_related('project')
            .annotate(member_count=Count('memberships', filter=Q(memberships__is_deleted=False), distinct=True))
            .prefetch_related(
                Prefetch(
                    'messages',
                    queryset=ChannelMessage.objects.select_related('sender', 'sender__artist_profile').order_by('created_at'),
                )
            )
            .get(pk=channel.pk)
        )
        membership = ChannelMembership.objects.filter(
            channel=hydrated, user_id=request_user(request).id
        ).first()
        ctx = {
            'request': request,
            'read_map': {hydrated.id: membership.last_read_at if membership else None},
            'my_push_enabled': bool(membership and membership.push_enabled),
        }
        return Response(ChannelDetailSerializer(hydrated, context=ctx).data)

    def list(self, request: Request) -> Response:
        last_msg = ChannelMessage.objects.filter(channel=OuterRef('pk')).order_by('-created_at')
        channels = list(
            self.get_queryset()
            .annotate(
                last_body=Subquery(last_msg.values('body')[:1]),
                member_count=Count('memberships', filter=Q(memberships__is_deleted=False), distinct=True),
            )
            .order_by(F('last_message_at').desc(nulls_last=True))
        )
        read_map = self._read_map(request, [c.id for c in channels])
        serializer = ChannelListSerializer(channels, many=True, context={'request': request, 'read_map': read_map})
        return Response(serializer.data)

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        channel = self._get_accessible(request, pk)
        if channel is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return self._detail_response(request, channel)

    @action(detail=True, methods=['post'], url_path='messages')
    def post_message(self, request: Request, pk: str | None = None) -> Response:
        channel = self._get_accessible(request, pk)
        if channel is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ChannelMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = ChannelService.post_message(
            channel=channel, sender_id=request_user(request).id, body=serializer.validated_data['body']
        )
        return Response(ChannelMessageSerializer(message, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='read')
    def read(self, request: Request, pk: str | None = None) -> Response:
        channel = self._get_accessible(request, pk)
        if channel is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        ChannelService.mark_read(channel=channel, user_id=request_user(request).id)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['patch'], url_path='membership')
    def membership(self, request: Request, pk: str | None = None) -> Response:
        channel = self._get_accessible(request, pk)
        if channel is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ChannelPushPrefSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        enabled = serializer.validated_data['push_enabled']
        ChannelService.set_push_pref(channel=channel, user_id=request_user(request).id, enabled=enabled)
        return Response({"push_enabled": enabled})

    @action(detail=True, methods=['post'], url_path=r'messages/(?P<message_id>[0-9a-f-]+)/pin')
    def pin(self, request: Request, pk: str | None = None, message_id: str | None = None) -> Response:
        if not self._is_manager(request_user(request)):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        channel = self._get_accessible(request, pk)
        if channel is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        message = get_object_or_404(ChannelMessage, pk=message_id, channel=channel)
        serializer = ChannelPinSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ChannelService.set_pinned(message=message, pinned=serializer.validated_data['pinned'])
        return Response(ChannelMessageSerializer(message, context={'request': request}).data)

    @action(detail=False, methods=['get'], url_path=r'by-project/(?P<project_id>[0-9a-f-]+)')
    def by_project(self, request: Request, project_id: str | None = None) -> Response:
        user = request_user(request)
        project = get_object_or_404(Project, pk=project_id, is_deleted=False)
        if self._is_manager(user):
            channel = ChannelService.get_or_create_for_project(project)
            ChannelService.ensure_manager_membership(channel=channel, user=user)
        else:
            existing = ProjectChannel.objects.filter(project=project).first()
            if existing is None or not ChannelMembership.objects.filter(
                channel=existing, user_id=user.id
            ).exists():
                return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
            channel = existing
        return self._detail_response(request, channel)
