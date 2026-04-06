/**
 * @file ArchivePage.tsx
 * @description Routing entry point for the Archive module.
 * @module pages/app/ArchivePage
 */

import React from 'react';
import ArchiveManagement from '../../features/archive/ArchiveManagement';

export default function ArchivePage(): React.JSX.Element {
    return (
        <div className="page-container">
            <ArchiveManagement />
        </div>
    );
}