// chorister-hub/ChoristerHubPage.tsx
// "Moja Karta" — the chorister's membership identity surface. A persistent
// membership hero anchors three intent-scoped views: my ensemble (people),
// the knowledge base ("Niezbędnik"), and my long-horizon journey. Mobile-first.
// Default export required for React.lazy route loading.
import React, { Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Library, Users } from 'lucide-react';

import { useAuth } from '@/app/providers/AuthProvider';
import { SegmentedTabs } from '@/shared/ui/composites/SegmentedTabs';
import { ConfirmModal } from '@/shared/ui/composites/ConfirmModal';
import { PageTransition } from '@/shared/ui/kinematics/PageTransition';
import { EtherealLoader } from '@/shared/ui/kinematics/EtherealLoader';

import { MembershipCard } from './components/MembershipCard';
import { MySectionModule } from './components/MySectionModule';
import { KnowledgeBaseModule } from './components/KnowledgeBaseModule';
import { ArtistIdentityModule } from './components/ArtistIdentityModule';
import { CategoryFormModal } from './components/modals/CategoryFormModal';
import { DocumentUploadModal } from './components/modals/DocumentUploadModal';
import { DocumentPreviewModal } from './components/modals/DocumentPreviewModal';
import { useChoristerHub } from './hooks/useChoristerHub';

type Tab = 'team' | 'knowledge' | 'journey';

export default function ChoristerHubPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();

  const {
    isManagerUser,
    isCategoryModalOpen,
    isDocumentModalOpen,
    isPreviewModalOpen,
    editingCategory,
    targetCategory,
    previewDocument,
    isCategoryPending,
    isDocumentPending,
    pendingDeletion,
    isDeletionPending,
    handleAddCategory,
    handleEditCategory,
    handleCategoryModalSubmit,
    handleCategoryModalClose,
    handleUploadDocument,
    handleDocumentUploadSubmit,
    handleDocumentModalClose,
    requestDeleteCategory,
    requestDeleteDocument,
    handleConfirmDelete,
    handleCancelDelete,
    handlePreviewDocument,
    handlePreviewModalClose,
  } = useChoristerHub(user);

  // A manager has no concerts and no personal passport, so they get the curator
  // surface only: knowledge-base curation, no tabs. Choristers get the full set.
  const tabs = useMemo(
    () => [
      { id: 'team' as const, label: t('chorister_hub.tabs.team', 'Z kim śpiewam'), Icon: Users },
      { id: 'knowledge' as const, label: t('chorister_hub.tabs.knowledge', 'Niezbędnik'), Icon: Library },
      { id: 'journey' as const, label: t('chorister_hub.tabs.journey', 'Moja droga'), Icon: History },
    ],
    [t],
  );

  const [activeTab, setActiveTab] = useState<Tab>('team');

  const deletionCopy = pendingDeletion
    ? pendingDeletion.kind === 'category'
      ? {
          title: t('chorister_hub.confirm.category_title', 'Usunąć kategorię?'),
          description: t(
            'chorister_hub.confirm.category_body',
            'Kategoria „{{name}}" i wszystkie jej dokumenty zostaną usunięte. Tej operacji nie można cofnąć.',
            { name: pendingDeletion.category.name },
          ),
        }
      : {
          title: t('chorister_hub.confirm.document_title', 'Usunąć dokument?'),
          description: t(
            'chorister_hub.confirm.document_body',
            'Dokument „{{name}}" zostanie usunięty dla wszystkich. Tej operacji nie można cofnąć.',
            { name: pendingDeletion.document.title },
          ),
        }
    : { title: '', description: '' };

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl cursor-default space-y-6 px-1 pb-28 pt-6 sm:px-0">
        <Suspense fallback={<EtherealLoader />}>
          <MembershipCard />
        </Suspense>

        {isManagerUser ? (
          <Suspense fallback={<EtherealLoader />}>
            <KnowledgeBaseModule
              isManager
              onAddCategory={handleAddCategory}
              onEditCategory={handleEditCategory}
              onDeleteCategory={requestDeleteCategory}
              onUploadDocument={handleUploadDocument}
              onDeleteDocument={requestDeleteDocument}
              onPreviewDocument={handlePreviewDocument}
            />
          </Suspense>
        ) : (
          <>
            <SegmentedTabs
              ariaLabel={t('chorister_hub.tabs.aria_label', 'Sekcje karty')}
              items={tabs}
              value={activeTab}
              onChange={setActiveTab}
            />

            <Suspense fallback={<EtherealLoader />}>
              {activeTab === 'team' && <MySectionModule />}

              {activeTab === 'knowledge' && (
                <KnowledgeBaseModule
                  isManager={false}
                  onAddCategory={handleAddCategory}
                  onEditCategory={handleEditCategory}
                  onDeleteCategory={requestDeleteCategory}
                  onUploadDocument={handleUploadDocument}
                  onDeleteDocument={requestDeleteDocument}
                  onPreviewDocument={handlePreviewDocument}
                />
              )}

              {activeTab === 'journey' && <ArtistIdentityModule />}
            </Suspense>
          </>
        )}
      </div>

      {isManagerUser && (
        <>
          <CategoryFormModal
            isOpen={isCategoryModalOpen}
            editingCategory={editingCategory}
            onClose={handleCategoryModalClose}
            onSubmit={handleCategoryModalSubmit}
            isPending={isCategoryPending}
          />
          <DocumentUploadModal
            isOpen={isDocumentModalOpen}
            targetCategory={targetCategory}
            onClose={handleDocumentModalClose}
            onSubmit={handleDocumentUploadSubmit}
            isPending={isDocumentPending}
          />
          <ConfirmModal
            isOpen={pendingDeletion != null}
            title={deletionCopy.title}
            description={deletionCopy.description}
            onConfirm={handleConfirmDelete}
            onCancel={handleCancelDelete}
            isLoading={isDeletionPending}
            confirmText={t('common.actions.delete', 'Usuń')}
            cancelText={t('common.cancel', 'Anuluj')}
          />
        </>
      )}

      <DocumentPreviewModal
        isOpen={isPreviewModalOpen}
        previewDocument={previewDocument}
        onClose={handlePreviewModalClose}
      />
    </PageTransition>
  );
}
