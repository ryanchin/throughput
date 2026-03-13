import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/what-is-aava',
        'getting-started/how-to-use-this-site',
        'getting-started/certification-overview',
      ],
    },
    {
      type: 'category',
      label: 'AAVA Methodology',
      items: [
        {
          type: 'category',
          label: 'Goals & OKRs',
          items: [
            'methodology/goals-and-okrs/overview',
            'methodology/goals-and-okrs/goal-extraction',
            'methodology/goals-and-okrs/okr-decomposition',
            'methodology/goals-and-okrs/alignment-validation',
          ],
        },
        {
          type: 'category',
          label: 'Research & Discovery',
          items: [
            'methodology/research/overview',
            'methodology/research/user-research-synthesis',
            'methodology/research/competitive-analysis',
            'methodology/research/market-sizing',
          ],
        },
        {
          type: 'category',
          label: 'Ideation & Prioritization',
          items: [
            'methodology/ideation/overview',
            'methodology/ideation/opportunity-scoring',
            'methodology/ideation/feature-prioritization',
            'methodology/ideation/impact-mapping',
          ],
        },
        {
          type: 'category',
          label: 'Roadmapping',
          items: [
            'methodology/roadmapping/overview',
            'methodology/roadmapping/roadmap-generation',
            'methodology/roadmapping/dependency-analysis',
            'methodology/roadmapping/timeline-estimation',
          ],
        },
        {
          type: 'category',
          label: 'Sprint Planning',
          items: [
            'methodology/sprint-planning/overview',
            'methodology/sprint-planning/story-generation',
            'methodology/sprint-planning/capacity-planning',
            'methodology/sprint-planning/sprint-goal-setting',
          ],
        },
        {
          type: 'category',
          label: 'Execution & Tracking',
          items: [
            'methodology/execution/overview',
            'methodology/execution/progress-tracking',
            'methodology/execution/risk-identification',
            'methodology/execution/stakeholder-updates',
          ],
        },
        {
          type: 'category',
          label: 'Retrospective & Learning',
          items: [
            'methodology/retrospective/overview',
            'methodology/retrospective/retro-synthesis',
            'methodology/retrospective/action-item-tracking',
            'methodology/retrospective/continuous-improvement',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Certifications',
      items: [
        'certifications/overview',
        'certifications/foundations',
        'certifications/practitioner',
        'certifications/specialist',
        'certifications/domain-certifications',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/embedding-content',
      ],
    },
  ],
};

export default sidebars;
