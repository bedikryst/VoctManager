// chorister-hub/api/chorister-hub.service.ts
import api from '@/shared/api/api';
import type {
  DocumentCategoryDTO,
  DocumentCategoryCreateDTO,
  DocumentCategoryUpdateDTO,
  DocumentFileDTO,
  ArtistIdentityMetricsDTO,
  MyEnsembleDTO,
} from '../types/chorister-hub.dto';

const API_BASE = '/api/documents';

/**
 * `?artist=<id>` on the three read endpoints below asks what a member's card
 * looks like, for a manager. The server gates it in one place
 * (`core/preview.py`) and refuses rather than falling back to the caller's own
 * answer. Every one of these must be called through an arrow — React Query
 * hands the query function its own context object as the first argument.
 */
const previewParams = (previewArtistId?: string) =>
  previewArtistId ? { params: { artist: previewArtistId } } : undefined;

export const ChoristerHubService = {
  getCategories: (previewArtistId?: string): Promise<DocumentCategoryDTO[]> =>
    api
      .get<DocumentCategoryDTO[]>(`${API_BASE}/categories/`, previewParams(previewArtistId))
      .then((r) => r.data),

  createCategory: (dto: DocumentCategoryCreateDTO): Promise<DocumentCategoryDTO> =>
    api.post<DocumentCategoryDTO>(`${API_BASE}/categories/`, dto).then((r) => r.data),

  updateCategory: (id: string, dto: DocumentCategoryUpdateDTO): Promise<DocumentCategoryDTO> =>
    api.patch<DocumentCategoryDTO>(`${API_BASE}/categories/${id}/`, dto).then((r) => r.data),

  deleteCategory: (id: string): Promise<void> =>
    api.delete(`${API_BASE}/categories/${id}/`).then(() => undefined),

  uploadDocument: (categoryId: string, formData: FormData): Promise<DocumentFileDTO> =>
    api
      .post<DocumentFileDTO>(`${API_BASE}/categories/${categoryId}/documents/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),

  deleteDocument: (categoryId: string, documentId: string): Promise<void> =>
    api
      .delete(`${API_BASE}/categories/${categoryId}/documents/${documentId}/`)
      .then(() => undefined),

  getArtistMetrics: (previewArtistId?: string): Promise<ArtistIdentityMetricsDTO> =>
    api
      .get<ArtistIdentityMetricsDTO>(`${API_BASE}/artist-metrics/`, previewParams(previewArtistId))
      .then((r) => r.data),

  getMyEnsemble: (previewArtistId?: string): Promise<MyEnsembleDTO> =>
    api
      .get<MyEnsembleDTO>(`${API_BASE}/my-ensemble/`, previewParams(previewArtistId))
      .then((r) => r.data),

  fetchDocumentBlob: (documentId: string): Promise<Blob> =>
    api
      .get(`${API_BASE}/${documentId}/download/`, { responseType: 'blob' })
      .then((r) => r.data as Blob),
};
