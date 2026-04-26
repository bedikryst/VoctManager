// chorister-hub/api/chorister-hub.queries.ts
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import { choristerHubKeys } from './chorister-hub.query-keys';
import { ChoristerHubService } from './chorister-hub.service';
import type {
  DocumentCategoryDTO,
  DocumentCategoryCreateDTO,
  DocumentCategoryUpdateDTO,
  DocumentFileDTO,
} from '../types/chorister-hub.dto';

const CATEGORIES_STALE = 5 * 60 * 1000;
const METRICS_STALE = 10 * 60 * 1000;

export const useDocumentCategories = () =>
  useSuspenseQuery({
    queryKey: choristerHubKeys.categories.list(),
    queryFn: ChoristerHubService.getCategories,
    staleTime: CATEGORIES_STALE,
  });

export const useArtistMetrics = () =>
  useSuspenseQuery({
    queryKey: choristerHubKeys.artistMetrics.mine(),
    queryFn: ChoristerHubService.getArtistMetrics,
    staleTime: METRICS_STALE,
  });

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ChoristerHubService.createCategory,
    onMutate: async (dto: DocumentCategoryCreateDTO) => {
      await queryClient.cancelQueries({ queryKey: choristerHubKeys.categories.all });
      const previous = queryClient.getQueryData<DocumentCategoryDTO[]>(
        choristerHubKeys.categories.list(),
      );
      const optimistic: DocumentCategoryDTO = {
        id: `optimistic-${Date.now()}`,
        slug: '',
        documents: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...dto,
      };
      queryClient.setQueryData<DocumentCategoryDTO[]>(choristerHubKeys.categories.list(), (old) => [
        ...(old ?? []),
        optimistic,
      ]);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(choristerHubKeys.categories.list(), ctx.previous);
      }
      toast.error(t('chorister_hub.toast.category_create_error', 'Category creation failed.'));
    },
    onSuccess: () => {
      toast.success(t('chorister_hub.toast.category_created', 'Category created.'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: choristerHubKeys.categories.all });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: DocumentCategoryUpdateDTO }) =>
      ChoristerHubService.updateCategory(id, dto),
    onMutate: async ({ id, dto }) => {
      await queryClient.cancelQueries({ queryKey: choristerHubKeys.categories.all });
      const previous = queryClient.getQueryData<DocumentCategoryDTO[]>(
        choristerHubKeys.categories.list(),
      );
      queryClient.setQueryData<DocumentCategoryDTO[]>(
        choristerHubKeys.categories.list(),
        (old) => old?.map((cat) => (cat.id === id ? { ...cat, ...dto } : cat)) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(choristerHubKeys.categories.list(), ctx.previous);
      }
      toast.error(t('chorister_hub.toast.category_update_error', 'Category update failed.'));
    },
    onSuccess: () => {
      toast.success(t('chorister_hub.toast.category_updated', 'Category updated.'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: choristerHubKeys.categories.all });
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ChoristerHubService.deleteCategory,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: choristerHubKeys.categories.all });
      const previous = queryClient.getQueryData<DocumentCategoryDTO[]>(
        choristerHubKeys.categories.list(),
      );
      queryClient.setQueryData<DocumentCategoryDTO[]>(
        choristerHubKeys.categories.list(),
        (old) => old?.filter((cat) => cat.id !== id) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(choristerHubKeys.categories.list(), ctx.previous);
      }
      toast.error(t('chorister_hub.toast.category_delete_error', 'Category deletion failed.'));
    },
    onSuccess: () => {
      toast.success(t('chorister_hub.toast.category_deleted', 'Category removed.'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: choristerHubKeys.categories.all });
    },
  });
};

export const useUploadDocument = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ categoryId, formData }: { categoryId: string; formData: FormData }) =>
      ChoristerHubService.uploadDocument(categoryId, formData),
    onMutate: async ({ categoryId, formData }) => {
      await queryClient.cancelQueries({ queryKey: choristerHubKeys.categories.all });
      const previous = queryClient.getQueryData<DocumentCategoryDTO[]>(
        choristerHubKeys.categories.list(),
      );
      const file = formData.get('file') instanceof File ? (formData.get('file') as File) : null;
      const optimisticDoc: DocumentFileDTO = {
        id: `optimistic-doc-${Date.now()}`,
        title: file ? file.name : '...',
        description: '',
        file_url: '',
        file_size_bytes: file ? file.size : 0,
        mime_type: file ? file.type : 'application/pdf',
        allowed_roles: [],
        order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      queryClient.setQueryData<DocumentCategoryDTO[]>(
        choristerHubKeys.categories.list(),
        (old) =>
          old?.map((cat) =>
            cat.id === categoryId
              ? { ...cat, documents: [...cat.documents, optimisticDoc] }
              : cat,
          ) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(choristerHubKeys.categories.list(), ctx.previous);
      }
      toast.error(t('chorister_hub.toast.document_upload_error', 'Document upload failed.'));
    },
    onSuccess: () => {
      toast.success(t('chorister_hub.toast.document_uploaded', 'Document uploaded.'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: choristerHubKeys.categories.all });
    },
  });
};

export const useDeleteDocument = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ categoryId, documentId }: { categoryId: string; documentId: string }) =>
      ChoristerHubService.deleteDocument(categoryId, documentId),
    onMutate: async ({ categoryId, documentId }) => {
      await queryClient.cancelQueries({ queryKey: choristerHubKeys.categories.all });
      const previous = queryClient.getQueryData<DocumentCategoryDTO[]>(
        choristerHubKeys.categories.list(),
      );
      queryClient.setQueryData<DocumentCategoryDTO[]>(
        choristerHubKeys.categories.list(),
        (old) =>
          old?.map((cat) =>
            cat.id === categoryId
              ? { ...cat, documents: cat.documents.filter((d) => d.id !== documentId) }
              : cat,
          ) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(choristerHubKeys.categories.list(), ctx.previous);
      }
      toast.error(t('chorister_hub.toast.document_delete_error', 'Document deletion failed.'));
    },
    onSuccess: () => {
      toast.success(t('chorister_hub.toast.document_deleted', 'Document removed.'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: choristerHubKeys.categories.all });
    },
  });
};
