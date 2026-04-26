// chorister-hub/ChoristerHubPage.tsx
// Default export required for React.lazy route loading.
import React, { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/app/providers/AuthProvider';
import { PageHeader } from '@/shared/ui/composites/PageHeader';
import { PageTransition } from '@/shared/ui/kinematics/PageTransition';
import { EtherealLoader } from '@/shared/ui/kinematics/EtherealLoader';
import { Button } from '@/shared/ui/primitives/Button';
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from '@/shared/ui/kinematics/StaggeredBentoGrid';

import { KnowledgeBaseModule } from './components/KnowledgeBaseModule';
import { ArtistIdentityModule } from './components/ArtistIdentityModule';
import { CategoryFormModal } from './components/modals/CategoryFormModal';
import { DocumentUploadModal } from './components/modals/DocumentUploadModal';
import { DocumentPreviewModal } from './components/modals/DocumentPreviewModal';
import { useChoristerHub } from './hooks/useChoristerHub';

type Tab = 'identity' | 'knowledge';

export default function ChoristerHubPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<Tab>('identity');

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
    handleAddCategory,
    handleEditCategory,
    handleDeleteCategory,
    handleCategoryModalSubmit,
    handleCategoryModalClose,
    handleUploadDocument,
    handleDocumentUploadSubmit,
    handleDeleteDocument,
    handleDocumentModalClose,
    handlePreviewDocument,
    handlePreviewModalClose,
  } = useChoristerHub(user);

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto px-4 md:px-6 pb-24 cursor-default space-y-8">
        <div className="pt-6">
          <PageHeader
            size="standard"
            roleText={t('chorister_hub.page.badge', 'Knowledge & Identity')}
            title={t('chorister_hub.page.title', 'Chorister')}
            titleHighlight={t('chorister_hub.page.title_highlight', 'Hub.')}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant={activeTab === 'identity' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('identity')}
          >
            {t('chorister_hub.tabs.identity', 'Artist Profile & History')}
          </Button>
          <Button
            variant={activeTab === 'knowledge' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('knowledge')}
          >
            {t('chorister_hub.tabs.knowledge', 'Knowledge Base')}
          </Button>
        </div>

        <StaggeredBentoContainer className="flex flex-col gap-10">
          {activeTab === 'identity' && (
            <StaggeredBentoItem key="identity">
              <Suspense fallback={<EtherealLoader />}>
                <ArtistIdentityModule />
              </Suspense>
            </StaggeredBentoItem>
          )}

          {activeTab === 'knowledge' && (
            <StaggeredBentoItem key="knowledge">
              <Suspense fallback={<EtherealLoader />}>
                <KnowledgeBaseModule
                  isManager={isManagerUser}
                  onAddCategory={handleAddCategory}
                  onEditCategory={handleEditCategory}
                  onDeleteCategory={handleDeleteCategory}
                  onUploadDocument={handleUploadDocument}
                  onDeleteDocument={handleDeleteDocument}
                  onPreviewDocument={handlePreviewDocument}
                />
              </Suspense>
            </StaggeredBentoItem>
          )}
        </StaggeredBentoContainer>
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
