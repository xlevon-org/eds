import {
  Handbook,
  HandbookFolder,
  HandbookKind,
  HandbookStatus,
  StepType,
} from '../../domain/entities/Handbook';
import { DomainError, Result } from '../../domain/errors/DomainError';
import {
  CurriculumTemplate,
  ITemplateGenerator,
} from '../../domain/repositories/IHandbookRepository';

export const INITIAL_FOLDERS: ReadonlyArray<HandbookFolder> = [
  {
    id: 'folder-stem',
    name: 'Science & Lab Experiments',
    departmentCode: 'SCI-DEPT',
    description: 'Easy lab safety rules, microscope steps, and science experiment guides.',
  },
  {
    id: 'folder-cs',
    name: 'Coding & Computer Projects',
    departmentCode: 'CS-ENG',
    description: 'Code editor setup, project saving steps, and computer class guides.',
  },
  {
    id: 'folder-lms',
    name: 'Class Portal & Homework Help',
    departmentCode: 'ED-TECH',
    description: 'First-week class sign-in, laptop setup, and homework upload guides.',
  },
  {
    id: 'folder-iep',
    name: 'Reading & Study Helpers',
    departmentCode: 'STU-SUPP',
    description: 'Read-aloud tools, extra time timers, and easy study checklists.',
  },
];

export const INITIAL_SEED_HANDBOOKS: ReadonlyArray<Handbook> = [
  {
    id: 'hb-seed-chem-lab',
    title: 'Chemistry Lab — Safe Mixing & pH Sensor Guide',
    subtitle:
      'Step-by-step visual guide for wearing safety goggles, connecting the pH sensor, and recording measurements.',
    courseCode: 'CHEM-301',
    gradeLevel: 'Grades 9–12',
    academicTerm: 'Fall 2026',
    authorName: 'Dr. Elena Rostova',
    departmentFolderId: 'folder-stem',
    status: HandbookStatus.PUBLISHED,
    kind: HandbookKind.STEP_GUIDE,
    isStarred: true,
    isTrashed: false,
    revision: 4,
    createdAt: '2026-09-12T08:30:00.000Z',
    updatedAt: '2026-10-08T14:20:00.000Z',
    viewCount: 342,
    downloadedPdfCount: 128,
    steps: [
      {
        id: 'step-chem-1',
        orderIndex: 1,
        type: StepType.WARNING,
        title: 'Put on your safety goggles and lab gloves before walking to your table',
        description:
          'Keep your goggles on the whole time so your eyes stay safe during the experiment.',
        expectedStudentOutcome: 'Teacher checks that goggles and gloves are on.',
        durationMinutes: 3,
        isRequiredForSignOff: true,
      },
      {
        id: 'step-chem-2',
        orderIndex: 2,
        type: StepType.ACTION,
        title: 'Open the Science Sensor App and click "Setup pH Sensor"',
        description:
          'Plug the sensor cable into USB Port 1 on your laptop and wait 3 seconds for the numbers to appear.',
        expectedStudentOutcome: 'Sensor screen shows pH 7.00 ready status.',
        durationMinutes: 5,
        isRequiredForSignOff: true,
        annotation: {
          xPercent: 68,
          yPercent: 42,
          label: 'Setup pH Sensor Button',
          highlightColor: '#09090b',
        },
        mockup: {
          appTitle: 'Science Sensor Lab v5.4',
          urlBar: 'https://lab.school.edu/sensors/ph-setup',
          activeElementLabel: 'Setup pH Sensor',
          screenTheme: 'lab-simulator',
          redactedPii: true,
          zoomScale: 1.15,
        },
      },
      {
        id: 'step-chem-3',
        orderIndex: 3,
        type: StepType.ACTION,
        title: 'Type your starting liquid amount (mL) into the Lab Table box',
        description:
          'Look closely at the measuring tube at eye level and write down the exact number.',
        expectedStudentOutcome: 'Starting number is saved in the table.',
        durationMinutes: 4,
        isRequiredForSignOff: true,
        annotation: {
          xPercent: 35,
          yPercent: 64,
          label: 'Starting Volume (mL) Box',
          highlightColor: '#09090b',
        },
        mockup: {
          appTitle: 'Science Sensor Lab v5.4',
          urlBar: 'https://lab.school.edu/experiment/table',
          activeElementLabel: 'Starting Volume (mL) Box',
          screenTheme: 'lab-simulator',
          redactedPii: true,
          zoomScale: 1.0,
        },
      },
      {
        id: 'step-chem-4',
        orderIndex: 4,
        type: StepType.TIP,
        title: 'Helpful Tip: Add one slow drop at a time when pH reaches 5.8',
        description:
          'Adding drops slowly helps you catch the exact moment the liquid changes!',
        expectedStudentOutcome: 'Smooth graph line appears on screen.',
        durationMinutes: 8,
        isRequiredForSignOff: false,
      },
      {
        id: 'step-chem-5',
        orderIndex: 5,
        type: StepType.CHECKPOINT,
        title: 'Click "Save & Export Results" and clean your lab table',
        description:
          'Rinse your sensor with clean water and ask your lab partner to check your table.',
        expectedStudentOutcome: 'Results file is saved and table is clean.',
        durationMinutes: 5,
        isRequiredForSignOff: true,
        annotation: {
          xPercent: 81,
          yPercent: 28,
          label: 'Save & Export Results',
          highlightColor: '#09090b',
        },
        mockup: {
          appTitle: 'Science Sensor Lab v5.4',
          urlBar: 'https://lab.school.edu/experiment/export',
          activeElementLabel: 'Save & Export Results',
          screenTheme: 'lab-simulator',
          redactedPii: true,
          zoomScale: 1.1,
        },
      },
    ],
    versions: [
      {
        versionId: 'ver-chem-10',
        versionNumber: 'v1.0',
        createdAt: '2026-09-12T08:30:00.000Z',
        authorName: 'Dr. Elena Rostova',
        changeSummary: 'First Fall 2026 Chemistry Lab Guide',
        stepCount: 5,
        snapshotTitle: 'Chemistry Lab — Safe Mixing & pH Sensor Guide',
        snapshotSteps: [],
      },
    ],
  },
  {
    id: 'hb-seed-canvas-lms',
    title: 'Class Portal — How to Turn In Your Homework PDF',
    subtitle:
      'Simple 3-step picture guide showing how to name your homework file, upload it, and check that it was turned in.',
    courseCode: 'ORI-101',
    gradeLevel: 'Grades 5–10',
    academicTerm: 'Fall 2026',
    authorName: 'Marcus Vance, M.Ed.',
    departmentFolderId: 'folder-lms',
    status: HandbookStatus.PUBLISHED,
    kind: HandbookKind.COURSE_PAGE_PACKET,
    isStarred: true,
    isTrashed: false,
    revision: 2,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-10-05T16:45:00.000Z',
    viewCount: 518,
    downloadedPdfCount: 245,
    steps: [
      {
        id: 'step-lms-1',
        orderIndex: 1,
        type: StepType.HEADER,
        title: 'Part 1: Naming Your Homework File Clearly',
        description:
          'Name your file with your Last Name, First Name, and Lesson Number (like: Smith_Alex_Lesson2.pdf).',
        durationMinutes: 2,
        isRequiredForSignOff: false,
      },
      {
        id: 'step-lms-2',
        orderIndex: 2,
        type: StepType.ACTION,
        title: 'Open your class page and click the "Start Assignment" button',
        description:
          'Look in the top-right corner of the page for the dark button labeled Start Assignment.',
        expectedStudentOutcome: 'The file upload box opens at the bottom of the page.',
        durationMinutes: 2,
        isRequiredForSignOff: true,
        annotation: {
          xPercent: 84,
          yPercent: 24,
          label: 'Start Assignment Button',
          highlightColor: '#09090b',
        },
        mockup: {
          appTitle: 'Class Portal — Lesson 2',
          urlBar: 'https://school.edu/courses/402/assignments/891',
          activeElementLabel: 'Start Assignment',
          screenTheme: 'lms-canvas',
          redactedPii: true,
          zoomScale: 1.0,
        },
      },
      {
        id: 'step-lms-3',
        orderIndex: 3,
        type: StepType.ACTION,
        title: 'Choose your PDF file and click "Turn In Homework"',
        description:
          'Wait 2 seconds until you see the "Submitted!" message on screen before closing your laptop.',
        expectedStudentOutcome: '"Submitted!" checkmark appears on the right side.',
        durationMinutes: 3,
        isRequiredForSignOff: true,
        annotation: {
          xPercent: 48,
          yPercent: 72,
          label: 'Turn In Homework Button',
          highlightColor: '#09090b',
        },
        mockup: {
          appTitle: 'Class Portal — File Upload Box',
          urlBar: 'https://school.edu/courses/402/assignments/891#submit',
          activeElementLabel: 'Turn In Homework',
          screenTheme: 'lms-canvas',
          redactedPii: true,
          zoomScale: 1.15,
        },
      },
    ],
    versions: [
      {
        versionId: 'ver-lms-10',
        versionNumber: 'v1.0',
        createdAt: '2026-09-01T10:00:00.000Z',
        authorName: 'Marcus Vance, M.Ed.',
        changeSummary: 'Student homework guide v1.0',
        stepCount: 3,
        snapshotTitle: 'Class Portal — How to Turn In Your Homework PDF',
        snapshotSteps: [],
      },
    ],
  },
  {
    id: 'hb-seed-cs-git',
    title: 'Coding Class — How to Download, Test & Save Your Code Project',
    subtitle:
      'Step-by-step handbook for opening your starter code project, running the test checker, and saving your work.',
    courseCode: 'CS-204',
    gradeLevel: 'Grades 8–12',
    academicTerm: 'Fall 2026',
    authorName: 'Prof. Devon Brooks',
    departmentFolderId: 'folder-cs',
    status: HandbookStatus.DRAFT,
    kind: HandbookKind.STEP_GUIDE,
    isStarred: false,
    isTrashed: false,
    revision: 1,
    createdAt: '2026-10-01T11:15:00.000Z',
    updatedAt: '2026-10-09T09:10:00.000Z',
    viewCount: 89,
    downloadedPdfCount: 34,
    steps: [
      {
        id: 'step-cs-1',
        orderIndex: 1,
        type: StepType.ACTION,
        title: 'Click "Accept Project" to create your own personal coding folder',
        description:
          'Wait about 5 seconds and refresh the page to open your new project link.',
        expectedStudentOutcome: 'Your personal project folder is ready to open.',
        durationMinutes: 2,
        isRequiredForSignOff: true,
        annotation: {
          xPercent: 52,
          yPercent: 56,
          label: 'Accept Project Button',
          highlightColor: '#09090b',
        },
        mockup: {
          appTitle: 'Coding Classroom — Project 03',
          urlBar: 'https://classroom.school.edu/a/coding-project-03',
          activeElementLabel: 'Accept Project',
          screenTheme: 'git-terminal',
          redactedPii: true,
          zoomScale: 1.0,
        },
      },
      {
        id: 'step-cs-2',
        orderIndex: 2,
        type: StepType.ACTION,
        title: 'Run the Test Checker and make sure all tests pass before saving',
        description:
          'Look for "14/14 Tests Passed" in the bottom box, then click Save & Push.',
        expectedStudentOutcome: 'All 14 code checks show Passed.',
        durationMinutes: 6,
        isRequiredForSignOff: true,
        annotation: {
          xPercent: 29,
          yPercent: 78,
          label: 'Run Test Checker & Save',
          highlightColor: '#09090b',
        },
        mockup: {
          appTitle: 'Code Editor — Test Checker',
          urlBar: 'editor://workspace/project-03/tests',
          activeElementLabel: 'SUCCESS (14/14 Tests Passed)',
          screenTheme: 'git-terminal',
          redactedPii: true,
          zoomScale: 1.1,
        },
      },
    ],
    versions: [
      {
        versionId: 'ver-cs-10',
        versionNumber: 'v1.0',
        createdAt: '2026-10-01T11:15:00.000Z',
        authorName: 'Prof. Devon Brooks',
        changeSummary: 'First draft for Coding Project 3',
        stepCount: 2,
        snapshotTitle: 'Coding Class — How to Download, Test & Save Your Code Project',
        snapshotSteps: [],
      },
    ],
  },
];

export class CurriculumTemplateGenerator implements ITemplateGenerator {
  private readonly templates: ReadonlyArray<CurriculumTemplate> = [
    {
      templateId: 'tpl-stem-microscope',
      name: 'Microscope Setup & Slide Focusing Guide',
      category: 'STEM & Lab',
      gradeBand: 'Grades 5–12',
      courseCode: 'BIO-110',
      estimatedMinutes: 15,
      summary:
        'Easy picture guide showing how to place a glass slide, focus with the low lens first, and clean up safely.',
      buildHandbook: (authorName: string, folderId: string): Handbook => {
        const now = new Date().toISOString();
        return {
          id: `hb-tpl-${Date.now().toString(36)}`,
          title: 'Science Lab — How to Focus a Microscope Safely',
          subtitle: 'Simple desk checklist for looking at slides under 4x, 10x, and 40x lenses.',
          courseCode: 'BIO-110',
          gradeLevel: 'Grades 5–10',
          academicTerm: 'Fall 2026',
          authorName: authorName || 'Science Teacher',
          departmentFolderId: folderId || 'folder-stem',
          status: HandbookStatus.DRAFT,
          kind: HandbookKind.STEP_GUIDE,
          isStarred: false,
          isTrashed: false,
          revision: 1,
          createdAt: now,
          updatedAt: now,
          viewCount: 1,
          downloadedPdfCount: 0,
          steps: [
            {
              id: `s-${Date.now()}-1`,
              orderIndex: 1,
              type: StepType.ACTION,
              title: 'Turn the nosepiece until the shortest 4x lens clicks into place',
              description: 'Always start with the smallest lens so the glass slide has plenty of room.',
              expectedStudentOutcome: '4x lens clicks into place above the stage.',
              durationMinutes: 3,
              isRequiredForSignOff: true,
              annotation: {
                xPercent: 50,
                yPercent: 38,
                label: '4x Starter Lens Ring',
                highlightColor: '#09090b',
              },
              mockup: {
                appTitle: 'Microscope Stage Guide',
                urlBar: 'https://science.school.edu/microscope/step-1',
                activeElementLabel: '4x Starter Lens Locked',
                screenTheme: 'lab-simulator',
                redactedPii: true,
                zoomScale: 1.0,
              },
            },
            {
              id: `s-${Date.now()}-2`,
              orderIndex: 2,
              type: StepType.WARNING,
              title: 'Only turn the Small Fine Focus Knob when using the long 40x lens',
              description: 'Turning the big knob with the long lens can crack the glass slide.',
              expectedStudentOutcome: 'Student uses only the small focus knob.',
              durationMinutes: 4,
              isRequiredForSignOff: true,
            },
          ],
          versions: [],
        };
      },
    },
    {
      templateId: 'tpl-chromebook-exam',
      name: 'School Laptop Test-Day Readiness Checklist',
      category: 'LMS & Digital Tools',
      gradeBand: 'Grades 4–12',
      courseCode: 'EXAM-PREP',
      estimatedMinutes: 10,
      summary:
        'Quick checklist for checking battery power and opening the Test App on school laptops.',
      buildHandbook: (authorName: string, folderId: string): Handbook => {
        const now = new Date().toISOString();
        return {
          id: `hb-tpl-${Date.now().toString(36)}`,
          title: 'Test Day — How to Open the School Test App on Your Laptop',
          subtitle: 'Follow these easy steps at your desk before the class quiz begins.',
          courseCode: 'EXAM-100',
          gradeLevel: 'Grades 4–12',
          academicTerm: 'Fall 2026',
          authorName: authorName || 'Class Teacher',
          departmentFolderId: folderId || 'folder-lms',
          status: HandbookStatus.DRAFT,
          kind: HandbookKind.STEP_GUIDE,
          isStarred: false,
          isTrashed: false,
          revision: 1,
          createdAt: now,
          updatedAt: now,
          viewCount: 1,
          downloadedPdfCount: 0,
          steps: [
            {
              id: `s-${Date.now()}-1`,
              orderIndex: 1,
              type: StepType.ACTION,
              title: 'Sign out of your laptop and click the "Apps" button in the bottom-left corner',
              description: 'The Test App opens right from the bottom-left corner of the sign-in screen.',
              expectedStudentOutcome: 'Apps menu opens and shows the Test App icon.',
              durationMinutes: 3,
              isRequiredForSignOff: true,
              annotation: {
                xPercent: 18,
                yPercent: 86,
                label: 'Bottom-Left Apps Menu',
                highlightColor: '#09090b',
              },
              mockup: {
                appTitle: 'School Laptop Lock Screen',
                urlBar: 'chrome://apps/test-mode',
                activeElementLabel: 'Apps -> Open Test Mode',
                screenTheme: 'chromebook-os',
                redactedPii: true,
                zoomScale: 1.1,
              },
            },
          ],
          versions: [],
        };
      },
    },
    {
      templateId: 'tpl-iep-accommodations',
      name: 'Read-Aloud Voice & Line Ruler Helper Guide',
      category: 'IEP & Accessibility',
      gradeBand: 'Grades 3–12',
      courseCode: 'READ-101',
      estimatedMinutes: 12,
      summary:
        'Friendly guide showing students how to turn on Read-Aloud voice and the 3-line reading ruler.',
      buildHandbook: (authorName: string, folderId: string): Handbook => {
        const now = new Date().toISOString();
        return {
          id: `hb-tpl-${Date.now().toString(36)}`,
          title: 'Reading Helper — How to Turn On Read-Aloud & Line Ruler',
          subtitle: 'Keep this printed card on your desk whenever you want the computer to read stories out loud.',
          courseCode: 'READ-101',
          gradeLevel: 'Grades 3–12',
          academicTerm: 'Fall 2026',
          authorName: authorName || 'Reading Teacher',
          departmentFolderId: folderId || 'folder-iep',
          status: HandbookStatus.DRAFT,
          kind: HandbookKind.STEP_GUIDE,
          isStarred: false,
          isTrashed: false,
          revision: 1,
          createdAt: now,
          updatedAt: now,
          viewCount: 1,
          downloadedPdfCount: 0,
          steps: [
            {
              id: `s-${Date.now()}-1`,
              orderIndex: 1,
              type: StepType.ACTION,
              title: 'Plug in your headphones and click the "Read Aloud" button in the top-right corner',
              description: 'You can make the voice read slower or faster using the speed slider.',
              expectedStudentOutcome: 'Voice reader and reading ruler turn on.',
              durationMinutes: 3,
              isRequiredForSignOff: true,
              annotation: {
                xPercent: 88,
                yPercent: 18,
                label: 'Turn On Read-Aloud',
                highlightColor: '#09090b',
              },
              mockup: {
                appTitle: 'Student Story Reader',
                urlBar: 'https://portal.school.edu/reader/helper',
                activeElementLabel: 'Read-Aloud: ON (Normal Speed)',
                screenTheme: 'iep-portal',
                redactedPii: true,
                zoomScale: 1.0,
              },
            },
          ],
          versions: [],
        };
      },
    },
  ];

  getTemplates(): ReadonlyArray<CurriculumTemplate> {
    return this.templates;
  }

  instantiateTemplate(
    templateId: string,
    authorName: string,
    folderId: string
  ): Result<Handbook> {
    const found = this.templates.find((t) => t.templateId === templateId);
    if (!found) {
      return Result.fail(
        new DomainError('ENTITY_NOT_FOUND', `Template "${templateId}" was not found.`, {
          templateId,
        })
      );
    }
    return Result.ok(found.buildHandbook(authorName, folderId));
  }
}
