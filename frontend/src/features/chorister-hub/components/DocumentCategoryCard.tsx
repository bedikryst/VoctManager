// chorister-hub/components/DocumentCategoryCard.tsx
import React from "react";
import {
  BookOpen,
  Shirt,
  FileText,
  Shield,
  HeartPulse,
  Music,
  Users,
  Briefcase,
  MapPin,
  Landmark,
  GraduationCap,
  ScrollText,
  Scale,
  Mic2,
  Download,
  Trash2,
  Plus,
  Edit2,
  Eye,
  type LucideIcon,
} from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import {
  Heading,
  Text,
  Eyebrow,
  Caption,
} from "@/shared/ui/primitives/typography";
import { Badge } from "@/shared/ui/primitives/Badge";
import { cn } from "@/shared/lib/utils";
import type {
  DocumentCategoryDTO,
  DocumentFileDTO,
  DocumentIconKey,
} from "../types/chorister-hub.dto";

const ICON_MAP: Record<DocumentIconKey, LucideIcon> = {
  BookOpen,
  Shirt,
  FileText,
  Shield,
  HeartPulse,
  Music,
  Users,
  Briefcase,
  MapPin,
  Landmark,
  GraduationCap,
  ScrollText,
  Scale,
  Mic2,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

interface DocumentRowProps {
  doc: DocumentFileDTO;
  isManager: boolean;
  categoryId: string;
  onDelete: (categoryId: string, documentId: string) => void;
  onPreview: (doc: DocumentFileDTO) => void;
}

import { useTranslation } from "react-i18next";

const DocumentRow = ({
  doc,
  isManager,
  categoryId,
  onDelete,
  onPreview,
}: DocumentRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const isPdf = doc.mime_type === "application/pdf";
  return (
    <GlassCard
      variant="light"
      padding="none"
      isHoverable={false}
      className="group/file flex items-stretch justify-between p-4 cursor-pointer active:scale-[0.99] hover:bg-ethereal-parchment/30 transition-colors"
      onClick={() =>
        isPdf
          ? onPreview(doc)
          : window.open(doc.file_url, "_blank", "noopener,noreferrer")
      }
    >
      <div className="flex items-start gap-4 overflow-hidden pr-4 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-ethereal-incense/20 bg-ethereal-alabaster text-ethereal-graphite group-hover/file:bg-ethereal-ink group-hover/file:text-white group-hover/file:border-transparent transition-colors shrink-0 shadow-sm">
          <FileText size={16} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <Text
            size="sm"
            weight="semibold"
            className="text-ethereal-ink truncate block"
            title={doc.title}
          >
            {doc.title}
          </Text>
          <div className="flex items-center gap-2 mt-1">
            <Eyebrow className="text-ethereal-graphite/70">
              {doc.mime_type.split("/")[1]?.toUpperCase() ?? "FILE"}
            </Eyebrow>
            <span
              className="w-1 h-1 rounded-full bg-ethereal-incense/30 shrink-0"
              aria-hidden="true"
            />
            <Caption color="muted">{formatBytes(doc.file_size_bytes)}</Caption>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 self-center shrink-0">
        {isPdf && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(doc);
            }}
            className="opacity-0 group-hover/file:opacity-100"
            aria-label={t(
              "chorister_hub.category.preview_aria",
              "Preview {{title}}",
              { title: doc.title },
            )}
          >
            <Eye size={15} aria-hidden="true" />
          </Button>
        )}
        {isManager && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(categoryId, doc.id);
            }}
            className="opacity-0 group-hover/file:opacity-100 hover:text-ethereal-crimson"
            aria-label={t(
              "chorister_hub.category.remove_aria",
              "Remove {{title}}",
              { title: doc.title },
            )}
          >
            <Trash2 size={14} aria-hidden="true" />
          </Button>
        )}
        <Button variant="ghost" size="icon" asChild>
          <a
            href={doc.file_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={t(
              "chorister_hub.category.download_aria",
              "Download {{title}}",
              { title: doc.title },
            )}
          >
            <Download size={16} aria-hidden="true" />
          </a>
        </Button>
      </div>
    </GlassCard>
  );
};

interface DocumentCategoryCardProps {
  category: DocumentCategoryDTO;
  isManager: boolean;
  onEdit: (category: DocumentCategoryDTO) => void;
  onDelete: (categoryId: string) => void;
  onUploadDocument: (category: DocumentCategoryDTO) => void;
  onDeleteDocument: (categoryId: string, documentId: string) => void;
  onPreviewDocument: (doc: DocumentFileDTO) => void;
}

export const DocumentCategoryCard = ({
  category,
  isManager,
  onEdit,
  onDelete,
  onUploadDocument,
  onDeleteDocument,
  onPreviewDocument,
}: DocumentCategoryCardProps): React.JSX.Element => {
  const IconComponent = ICON_MAP[category.icon_key] ?? BookOpen;
  const { t } = useTranslation();
  return (
    <GlassCard
      variant="ethereal"
      padding="lg"
      isHoverable={false}
      className="flex flex-col h-full group relative overflow-hidden"
    >
      <div
        className="absolute -right-6 -top-6 opacity-5 pointer-events-none text-ethereal-ink"
        aria-hidden="true"
      >
        <IconComponent size={96} />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-ethereal-gold/20 bg-ethereal-gold/10 text-ethereal-gold shadow-sm">
              <IconComponent size={20} aria-hidden="true" />
            </div>
            <div>
              <Heading size="lg" className="tracking-tight text-ethereal-ink">
                {category.name}
              </Heading>
              {category.description && (
                <Text
                  size="xs"
                  color="muted"
                  className="mt-1 leading-relaxed max-w-xs"
                >
                  {category.description}
                </Text>
              )}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {category.allowed_roles.map((role) => (
                  <Badge key={role} variant="glass">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {isManager && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(category)}
                aria-label={t(
                  "chorister_hub.category.edit_aria",
                  "Edit {{category}}",
                  { category: category.name },
                )}
              >
                <Edit2 size={14} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(category.id)}
                className="hover:text-ethereal-crimson hover:bg-ethereal-crimson/10"
                aria-label={t(
                  "chorister_hub.category.delete_aria",
                  "Delete {{category}}",
                  { category: category.name },
                )}
              >
                <Trash2 size={14} aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>

        <div
          className={cn(
            "mt-auto pt-4 space-y-3",
            category.documents.length === 0 && "pt-0",
          )}
        >
          {category.documents.length === 0 && !isManager && (
            <Text size="sm" color="muted" className="text-center py-4">
              {t(
                "chorister_hub.category.no_documents",
                "No documents available.",
              )}
            </Text>
          )}
          {category.documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              isManager={isManager}
              categoryId={category.id}
              onDelete={onDeleteDocument}
              onPreview={onPreviewDocument}
            />
          ))}

          {isManager && (
            <Button
              variant="ghost"
              fullWidth
              leftIcon={<Plus size={14} aria-hidden="true" />}
              onClick={() => onUploadDocument(category)}
              className="mt-2 border border-dashed border-ethereal-incense/30 hover:border-ethereal-ink/30"
            >
              {t("chorister_hub.category.upload", "Upload document")}
            </Button>
          )}
        </div>
      </div>
    </GlassCard>
  );
};
