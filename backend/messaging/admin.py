"""
@file admin.py
@description Django admin registration for messaging entities (support / triage).
@architecture Enterprise SaaS 2026
@module messaging/admin
"""
from django.contrib import admin

from .models import (
    ChannelMembership,
    ChannelMessage,
    Message,
    ProjectChannel,
    Thread,
    ThreadReadState,
)


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    fields = ('sender', 'body', 'created_at')
    readonly_fields = ('created_at',)


@admin.register(Thread)
class ThreadAdmin(admin.ModelAdmin):
    list_display = ('subject', 'artist', 'assignee', 'status', 'context_type', 'last_message_at')
    list_filter = ('status', 'context_type')
    search_fields = ('subject', 'artist__first_name', 'artist__last_name', 'artist__email')
    raw_id_fields = ('artist', 'assignee')
    inlines = (MessageInline,)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('thread', 'sender', 'created_at')
    search_fields = ('body',)
    raw_id_fields = ('thread', 'sender')


@admin.register(ThreadReadState)
class ThreadReadStateAdmin(admin.ModelAdmin):
    list_display = ('thread', 'user', 'last_read_at')
    raw_id_fields = ('thread', 'user')


class ChannelMessageInline(admin.TabularInline):
    model = ChannelMessage
    extra = 0
    fields = ('sender', 'body', 'is_pinned', 'created_at')
    readonly_fields = ('created_at',)


@admin.register(ProjectChannel)
class ProjectChannelAdmin(admin.ModelAdmin):
    list_display = ('project', 'last_message_at')
    raw_id_fields = ('project',)
    inlines = (ChannelMessageInline,)


@admin.register(ChannelMembership)
class ChannelMembershipAdmin(admin.ModelAdmin):
    list_display = ('channel', 'user', 'role', 'push_enabled', 'last_read_at')
    list_filter = ('role', 'push_enabled')
    raw_id_fields = ('channel', 'user')


@admin.register(ChannelMessage)
class ChannelMessageAdmin(admin.ModelAdmin):
    list_display = ('channel', 'sender', 'is_pinned', 'created_at')
    list_filter = ('is_pinned',)
    raw_id_fields = ('channel', 'sender')
