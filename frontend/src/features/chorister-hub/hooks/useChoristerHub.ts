// chorister-hub/hooks/useChoristerHub.ts
import { useState, useCallback } from 'react';

import { isManager } from '@/shared/auth/rbac';
import type { AuthUser } from '@/shared/auth/auth.types';
import {
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useUploadDocument,
  useDeleteDocument,
} from '../api/chorister-hub.queries';
import type { DocumentCategoryDTO, DocumentCategoryCreateDTO, DocumentCategoryUpdateDTO, DocumentFileDTO } from '../types/chorister-hub.dto';

export const useChoristerHub = (user: AuthUser | null) => {
  const isManagerUser = isManager(user);

  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [isDocumentModalOpen, setDocumentModalOpen] = useState(false);
  const [isPreviewModalOpen, setPreviewModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DocumentCategoryDTO | null>(null);
  const [targetCategory, setTargetCategory] = useState<DocumentCategoryDTO | null>(null);
  const [previewDocument, setPreviewDocument] = useState<DocumentFileDTO | null>(null);

  const { mutate: createCategory, isPending: isCreatingCategory } = useCreateCategory();
  const { mutate: updateCategory, isPending: isUpdatingCategory } = useUpdateCategory();
  const { mutate: deleteCategory } = useDeleteCategory();
  const { mutate: uploadDocument, isPending: isUploadingDocument } = useUploadDocument();
  const { mutate: deleteDocument } = useDeleteDocument();

  const handleAddCategory = useCallback(() => {
    setEditingCategory(null);
    setCategoryModalOpen(true);
  }, []);

  const handleEditCategory = useCallback((category: DocumentCategoryDTO) => {
    setEditingCategory(category);
    setCategoryModalOpen(true);
  }, []);

  const handleDeleteCategory = useCallback(
    (categoryId: string) => {
      deleteCategory(categoryId);
    },
    [deleteCategory],
  );

  const handleCategoryModalSubmit = useCallback(
    (values: DocumentCategoryCreateDTO, editId?: string) => {
      if (editId) {
        updateCategory(
          { id: editId, dto: values as DocumentCategoryUpdateDTO },
          {
            onSuccess: () => setCategoryModalOpen(false),
          },
        );
      } else {
        createCategory(values, {
          onSuccess: () => setCategoryModalOpen(false),
        });
      }
    },
    [createCategory, updateCategory],
  );

  const handleUploadDocument = useCallback((category: DocumentCategoryDTO) => {
    setTargetCategory(category);
    setDocumentModalOpen(true);
  }, []);

  const handleDocumentUploadSubmit = useCallback(
    (categoryId: string, formData: FormData) => {
      uploadDocument(
        { categoryId, formData },
        { onSuccess: () => setDocumentModalOpen(false) },
      );
    },
    [uploadDocument],
  );

  const handleDeleteDocument = useCallback(
    (categoryId: string, documentId: string) => {
      deleteDocument({ categoryId, documentId });
    },
    [deleteDocument],
  );

  const handleCategoryModalClose = useCallback(() => {
    setCategoryModalOpen(false);
    setEditingCategory(null);
  }, []);

  const handleDocumentModalClose = useCallback(() => {
    setDocumentModalOpen(false);
    setTargetCategory(null);
  }, []);

  const handlePreviewDocument = useCallback((doc: DocumentFileDTO) => {
    setPreviewDocument(doc);
    setPreviewModalOpen(true);
  }, []);

  const handlePreviewModalClose = useCallback(() => {
    setPreviewModalOpen(false);
    setPreviewDocument(null);
  }, []);

  return {
    isManagerUser,
    isCategoryModalOpen,
    isDocumentModalOpen,
    editingCategory,
    targetCategory,
    isCategoryPending: isCreatingCategory || isUpdatingCategory,
    isDocumentPending: isUploadingDocument,
    handleAddCategory,
    handleEditCategory,
    handleDeleteCategory,
    handleCategoryModalSubmit,
    handleCategoryModalClose,
    handleUploadDocument,
    handleDocumentUploadSubmit,
    handleDeleteDocument,
    handleDocumentModalClose,
    isPreviewModalOpen,
    previewDocument,
    handlePreviewDocument,
    handlePreviewModalClose,
  };
};
