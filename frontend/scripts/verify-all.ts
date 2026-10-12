import fs from 'fs';
import path from 'path';
import {
  EXPLICIT_ARCHITECTURAL_ASSUMPTIONS,
  SOLID_CLEAN_ARCHITECTURE_PROOFS,
  runFullVerificationSuite,
} from '../src/architecture/assumptionsAndVerification';

function walkFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walkFiles(path.join(dir, d.name)) : [path.join(dir, d.name)]
  );
}

function runStaticArchitectureAndGuidelineAudit() {
  const allSrcFiles = walkFiles('src').filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
  const violations: string[] = [];

  for (const file of allSrcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const imports = [...content.matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1]);

    // 1. Domain layer must not import from application, infrastructure, presentation, or React/UI
    if (file.startsWith('src/domain/')) {
      for (const imp of imports) {
        if (
          imp.includes('application') ||
          imp.includes('infrastructure') ||
          imp.includes('presentation') ||
          imp.includes('components') ||
          imp.includes('react')
        ) {
          violations.push(`Domain layer violation in ${file}: forbidden import "${imp}"`);
        }
      }
    }

    // 2. Application layer must depend only on Domain layer
    if (file.startsWith('src/application/')) {
      for (const imp of imports) {
        if (
          imp.includes('infrastructure') ||
          imp.includes('presentation') ||
          imp.includes('components') ||
          imp.includes('react')
        ) {
          violations.push(`Application layer violation in ${file}: forbidden import "${imp}"`);
        }
      }
    }

    // 3. Presentation UI components must never import concrete Infrastructure adapters
    if (file.startsWith('src/presentation/components/') || file === 'src/App.tsx') {
      for (const imp of imports) {
        if (imp.includes('infrastructure')) {
          violations.push(`Presentation layer violation in ${file}: forbidden import "${imp}"`);
        }
      }
    }

    // 4. Zero inline style={{ ... }} across all TypeScript/React files
    if (content.includes('style={{')) {
      violations.push(`Guideline violation in ${file}: contains inline style={{...}}`);
    }

    // 5. Zero window.alert / window.confirm / window.open
    if (
      content.includes('window.alert(') ||
      content.includes('window.confirm(') ||
      content.includes('window.open(')
    ) {
      violations.push(`Iframe constraint violation in ${file}: uses window.alert/confirm/open`);
    }
  }

  // 6. Verify dialog.tsx popup modal does not exist
  if (fs.existsSync('src/components/ui/dialog.tsx')) {
    violations.push('UI constraint violation: src/components/ui/dialog.tsx still exists');
  }

  return {
    scannedFilesCount: allSrcFiles.length,
    violations,
    passed: violations.length === 0,
  };
}

async function main() {
  console.log('=== 1. STATED ARCHITECTURAL ASSUMPTIONS & OPERATING CONDITIONS ===');
  for (const a of EXPLICIT_ARCHITECTURAL_ASSUMPTIONS) {
    console.log(`[${a.id}] (${a.category}): ${a.assumptionStatement}`);
    console.log(`  -> Evidence: ${a.factualEvidence}`);
    console.log(`  -> Works Under: ${a.operatingConditions}`);
    console.log(`  -> Non-Happy Fallback: ${a.fallbackWhenViolated}`);
  }

  console.log('\n=== 2. STATIC AST/IMPORT AUDIT (CLEAN ARCHITECTURE & GUIDELINES) ===');
  const staticAudit = runStaticArchitectureAndGuidelineAudit();
  console.log(
    `Scanned ${staticAudit.scannedFilesCount} source files -> Violations: ${staticAudit.violations.length}`
  );
  if (!staticAudit.passed) {
    for (const v of staticAudit.violations) {
      console.error(`  [VIOLATION] ${v}`);
    }
    process.exit(1);
  }

  console.log('\n=== 3. SOLID & CLEAN ARCHITECTURE BOUNDARY PROOFS ===');
  for (const p of SOLID_CLEAN_ARCHITECTURE_PROOFS) {
    console.log(`- ${p.principle}: ${p.implementation}`);
  }

  console.log('\n=== 4. EXECUTING 16 HAPPY + VARIATION + BACKEND SWAP SCENARIOS ===');
  const results = await runFullVerificationSuite();
  let failedCount = 0;
  for (const r of results) {
    const badge = r.passed ? 'PASS' : 'FAIL';
    if (!r.passed) failedCount++;
    console.log(
      `[${badge}] ${r.scenarioId} (${r.pathType} | ${r.durationMs}ms): ${r.title}\n       Input: ${r.inputCondition}\n       Proof: ${r.actualOutcome}`
    );
  }

  console.log(
    `\n=== SUMMARY: ${results.length - failedCount}/${results.length} SCENARIOS VERIFIED | 0 STATIC VIOLATIONS ===`
  );
  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
