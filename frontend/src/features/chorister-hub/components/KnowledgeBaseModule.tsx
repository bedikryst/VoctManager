// chorister-hub/components/KnowledgeBaseModule.tsx
import React from "react";
import { Plus, Library } from "lucide-react";
import { useTranslation } from "react-i18next";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Heading, Text } from "@/shared/ui/primitives/typography";
import { useDocumentCategories } from "../api/chorister-hub.queries";
import { DocumentCategoryCard } from "./DocumentCategoryCard";
import type { DocumentCategoryDTO, DocumentFileDTO } from "../types/chorister-hub.dto";

interface KnowledgeBaseModuleProps {
  isManager: boolean;
  onAddCategory: () => void;
  onEditCategory: (category: DocumentCategoryDTO) => void;
  onDeleteCategory: (categoryId: string) => void;
  onUploadDocument: (category: DocumentCategoryDTO) => void;
  onDeleteDocument: (categoryId: string, documentId: string) => void;
  onPreviewDocument: (doc: DocumentFileDTO) => void;
}

export const KnowledgeBaseModule = ({
  isManager,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onUploadDocument,
  onDeleteDocument,
  onPreviewDocument,
}: KnowledgeBaseModuleProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { data: categories } = useDocumentCategories();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-ethereal-gold/10 border border-ethereal-gold/20 flex items-center justify-center text-ethereal-gold">
            <Library size={18} aria-hidden="true" />
          </div>
          <div>
            <Heading size="xl" className="tracking-tight">
              {t("chorister_hub.knowledge_base.title", "Knowledge Base")}
            </Heading>
            <Text size="xs" color="muted">
              {t(
                "chorister_hub.knowledge_base.subtitle",
                "Regulations, policies and institutional documents",
              )}
            </Text>
          </div>
        </div>

        {isManager && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} aria-hidden="true" />}
            onClick={onAddCategory}
          >
            {t("chorister_hub.knowledge_base.add_category", "New category")}
          </Button>
        )}
      </div>

      {!categories || categories.length === 0 ? (
        <GlassCard
          variant="ethereal"
          padding="lg"
          className="text-center py-12"
        >
          <Library
            size={32}
            className="mx-auto text-ethereal-graphite/30 mb-3"
            aria-hidden="true"
          />
          <Text color="muted">
            {t(
              "chorister_hub.knowledge_base.empty",
              "No document categories have been configured.",
            )}
          </Text>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(categories || []).map((category) => (
            <DocumentCategoryCard
              key={category.id}
              category={category}
              isManager={isManager}
              onEdit={onEditCategory}
              onDelete={onDeleteCategory}
              onUploadDocument={onUploadDocument}
              onDeleteDocument={onDeleteDocument}
              onPreviewDocument={onPreviewDocument}
            />
          ))}
        </div>
      )}
    </div>
  );
};
