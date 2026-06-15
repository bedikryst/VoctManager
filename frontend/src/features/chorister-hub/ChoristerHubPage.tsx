// chorister-hub/ChoristerHubPage.tsx
// "Moja Kartoteka" — the chorister's long-horizon surface: artist passport
// (repertoire, seasons, voice lines) plus the institutional knowledge base.
// Default export required for React.lazy route loading.
import React, { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Library, UserRound } from 'lucide-react';

import { useAuth } from '@/app/providers/AuthProvider';
import { PageHeader } from '@/shared/ui/composites/PageHeader';
import { SegmentedTabs } from '@/shared/ui/composites/SegmentedTabs';
import { PageTransition } from '@/shared/ui/kinematics/PageTransition';
import { EtherealLoader } from '@/shared/ui/kinematics/EtherealLoader';
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

const TABS = [
  {
    id: 'identity' as const,
    labelKey: 'chorister_hub.tabs.identity',
    fallback: 'Kartoteka Artysty',
    Icon: UserRound,
  },
  {
    id: 'knowledge' as const,
    labelKey: 'chorister_hub.tabs.knowledge',
    fallback: 'Dokumenty',
    Icon: Library,
  },
];

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
      <div className="mx-auto max-w-5xl cursor-default space-y-6 px-4 pb-24 md:px-6">
        <div className="pt-6">
          <PageHeader
            size="standard"
            roleText={t('chorister_hub.page.badge', 'Historia i Wiedza')}
            title={t('chorister_hub.page.title', 'Moja')}
            titleHighlight={t('chorister_hub.page.title_highlight', 'Kartoteka.')}
          />
        </div>

        <SegmentedTabs
          ariaLabel={t('chorister_hub.tabs.aria_label', 'Sekcje kartoteki')}
          items={TABS.map(({ id, labelKey, fallback, Icon }) => ({
            id,
            label: t(labelKey, fallback),
            Icon,
          }))}
          value={activeTab}
          onChange={setActiveTab}
        />

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
