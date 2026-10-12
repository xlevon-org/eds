import { jsPDF } from 'jspdf';
import {
  Handbook,
  HandbookDomainPolicy,
  PrintConfiguration,
  StepType,
} from '../../domain/entities/Handbook';
import { DomainError, Result } from '../../domain/errors/DomainError';
import {
  IPdfExporter,
  PdfExportArtifact,
} from '../../domain/repositories/IHandbookRepository';

export class JsPdfHandbookExporter implements IPdfExporter {
  async exportHandbookToPdf(
    handbook: Handbook,
    config: PrintConfiguration
  ): Promise<Result<PdfExportArtifact>> {
    const validation = HandbookDomainPolicy.validatePrintReadiness(handbook, config);
    if (!validation.ok) return validation;

    try {
      const format = config.paperSize === 'A4' ? 'a4' : 'letter';
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format,
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 16;
      const contentWidth = pageWidth - margin * 2;
      let cursorY = margin;

      const drawHeaderFooter = (pageNum: number) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        doc.text(
          `up · ${config.institutionName || 'School Workspace'} · ${handbook.courseCode} · ${handbook.academicTerm}`,
          margin,
          10
        );
        doc.text(`Saved v1.${handbook.revision} · Printable Student Copy`, pageWidth - margin, 10, {
          align: 'right',
        });
        doc.setDrawColor(180, 180, 180);
        doc.line(margin, 12, pageWidth - margin, 12);

        // Footer
        doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
        doc.text(
          `up Handbook: ${handbook.title.slice(0, 58)}`,
          margin,
          pageHeight - 9
        );
        doc.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 9, {
          align: 'right',
        });
      };

      let currentPage = 1;
      drawHeaderFooter(currentPage);
      cursorY = 20;

      // 1. Monochrome Cover / Title Block
      if (config.includeCoverPage) {
        doc.setFillColor(246, 246, 246);
        doc.setDrawColor(20, 20, 20);
        doc.roundedRect(margin, cursorY, contentWidth, 42, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(
          `up HANDBOOK · ${handbook.courseCode} · ${handbook.gradeLevel.toUpperCase()} · ${handbook.academicTerm.toUpperCase()}`,
          margin + 5,
          cursorY + 8
        );

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor(0, 0, 0);
        const titleLines = doc.splitTextToSize(handbook.title, contentWidth - 10);
        doc.text(titleLines, margin + 5, cursorY + 16);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(50, 50, 50);
        const subLines = doc.splitTextToSize(handbook.subtitle, contentWidth - 10);
        doc.text(subLines, margin + 5, cursorY + 28);

        const totalMinutes = handbook.steps.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
        doc.setFontSize(8.5);
        doc.setTextColor(20, 20, 20);
        doc.text(
          `Teacher: ${handbook.authorName}   |   Steps: ${handbook.steps.length}   |   Time: ${totalMinutes} mins   |   Copies: ${config.copiesCount}`,
          margin + 5,
          cursorY + 38
        );

        cursorY += 48;
      }

      // 2. Table of Contents
      if (config.includeTableOfContents) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(0, 0, 0);
        doc.text('Step-by-Step Checklist', margin, cursorY);
        cursorY += 5;

        for (const step of handbook.steps) {
          if (cursorY > pageHeight - 26) {
            doc.addPage();
            currentPage += 1;
            drawHeaderFooter(currentPage);
            cursorY = 20;
          }
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(25, 25, 25);
          const checkPrefix = step.isRequiredForSignOff ? '[  ] ' : ' ·   ';
          const line = `${checkPrefix}Step ${step.orderIndex} (${step.type}): ${step.title.slice(0, 78)}`;
          doc.text(line, margin + 2, cursorY);
          doc.text(`${step.durationMinutes} min`, pageWidth - margin, cursorY, { align: 'right' });
          cursorY += 4.8;
        }
        cursorY += 6;
      }

      // 3. Detailed Step Cards (Crisp Black & White Print Formatting)
      for (const step of handbook.steps) {
        const needsMockupBox = Boolean(config.includeScreenshots && step.mockup);
        const estimatedBlockHeight = needsMockupBox ? 56 : 28;

        if (cursorY + estimatedBlockHeight > pageHeight - 22) {
          doc.addPage();
          currentPage += 1;
          drawHeaderFooter(currentPage);
          cursorY = 20;
        }

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(40, 40, 40);
        doc.roundedRect(margin, cursorY, contentWidth, estimatedBlockHeight - 3, 2, 2, 'FD');

        // Monochrome Step Number Circle
        doc.setFillColor(0, 0, 0);
        doc.circle(margin + 6.5, cursorY + 7, 3.6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text(String(step.orderIndex), margin + 6.5, cursorY + 8, { align: 'center' });

        // Step Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        const stepTitleLines = doc.splitTextToSize(
          `${step.type !== StepType.ACTION ? `[${step.type}] ` : ''}${step.title}`,
          contentWidth - 26
        );
        doc.text(stepTitleLines, margin + 13, cursorY + 6.5);

        // Step Description
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(55, 55, 55);
        const descLines = doc.splitTextToSize(
          step.description || 'Follow the picture below.',
          contentWidth - 20
        );
        doc.text(descLines, margin + 13, cursorY + 14);

        if (config.includeTeacherNotes && step.expectedStudentOutcome) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(20, 20, 20);
          doc.text(
            `Goal Check: ${step.expectedStudentOutcome.slice(0, 95)}`,
            margin + 13,
            cursorY + 21
          );
        }

        // Visual Screen Diagram + High-Contrast Black/White Target Ring
        if (needsMockupBox && step.mockup) {
          const boxX = margin + 13;
          const boxY = cursorY + 24;
          const boxW = contentWidth - 18;
          const boxH = 25;

          doc.setFillColor(245, 245, 245);
          doc.setDrawColor(100, 100, 100);
          doc.roundedRect(boxX, boxY, boxW, boxH, 1.5, 1.5, 'FD');

          doc.setFillColor(225, 225, 225);
          doc.rect(boxX, boxY, boxW, 5.5, 'F');
          doc.setFont('courier', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(20, 20, 20);
          doc.text(`${step.mockup.appTitle} — ${step.mockup.urlBar}`, boxX + 3, boxY + 3.8);

          const targetX =
            boxX +
            ((step.annotation ? step.annotation.xPercent : 50) / 100) * (boxW - 36) +
            10;
          const targetY =
            boxY +
            7 +
            ((step.annotation ? step.annotation.yPercent : 50) / 100) * (boxH - 12);

          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(80, 80, 80);
          doc.roundedRect(boxX + 6, boxY + 9, boxW - 12, 12, 1, 1, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(0, 0, 0);
          doc.text(
            `Click Here: ${step.annotation?.label || step.mockup.activeElementLabel}`,
            boxX + 10,
            boxY + 16
          );

          // High-Contrast Black Target Ring
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.8);
          doc.circle(targetX, targetY, 3.2, 'S');
          doc.setFillColor(0, 0, 0);
          doc.circle(targetX, targetY, 1.1, 'F');
          doc.setLineWidth(0.2);
        }

        cursorY += estimatedBlockHeight;
      }

      // 4. Student Hard-Copy Sign-Off Slip
      if (config.includeStudentSignOffSheet) {
        if (cursorY + 46 > pageHeight - 20) {
          doc.addPage();
          currentPage += 1;
          drawHeaderFooter(currentPage);
          cursorY = 20;
        } else {
          cursorY += 4;
        }

        doc.setDrawColor(0, 0, 0);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(margin, cursorY, pageWidth - margin, cursorY);
        doc.setLineDashPattern([], 0);

        cursorY += 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(
          'STUDENT & TEACHER COMPLETION SIGN-OFF SLIP',
          margin,
          cursorY
        );

        cursorY += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 30, 30);
        doc.text(
          `I finished all ${handbook.steps.length} steps in "${handbook.title}" (${handbook.courseCode}).`,
          margin,
          cursorY
        );

        cursorY += 10;
        doc.text('Student Name: _______________________________________', margin, cursorY);
        doc.text('Student ID #: _______________________', margin + 105, cursorY);

        cursorY += 10;
        doc.text('Student Signature: ___________________________________', margin, cursorY);
        doc.text('Date Finished: ______________________', margin + 105, cursorY);

        cursorY += 10;
        doc.text('Teacher Check / Stamp: _______________________________', margin, cursorY);
        doc.text('Class / Table #: ____________________', margin + 105, cursorY);
      }

      const safeSlug = handbook.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48);
      const filename = `up-${handbook.courseCode.toLowerCase()}-${safeSlug || 'handbook'}-v1.${
        handbook.revision
      }.pdf`;

      const arrayBuffer = doc.output('arraybuffer');
      const byteSize = arrayBuffer.byteLength;

      let dataUri: string | undefined;
      if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
        doc.save(filename);
        dataUri = doc.output('datauristring');
      }

      return Result.ok(
        {
          filename,
          pageCount: currentPage,
          byteSize,
          generatedAt: new Date().toISOString(),
          dataUri,
          warnings: validation.warnings || [],
        },
        validation.warnings
      );
    } catch (err) {
      return Result.fail(
        new DomainError(
          'EXPORT_PRECONDITION_FAILED',
          `PDF creation encountered an unexpected error: ${
            err instanceof Error ? err.message : String(err)
          }`
        )
      );
    }
  }
}
