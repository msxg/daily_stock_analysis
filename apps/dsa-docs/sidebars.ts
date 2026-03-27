import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'DSA UI 文档',
      link: {
        type: 'generated-index',
        title: 'DSA UI 文档中心',
        description: '包含重构方案、开发计划、任务跟踪与操作手册。',
      },
      items: [
        {
          type: 'category',
          label: 'DSA UI 操作手册',
          link: {type: 'doc', id: 'dsa-ui/user-manual'},
          items: [
            'dsa-ui/manual/navigation',
            'dsa-ui/manual/dashboard',
            'dsa-ui/manual/chat',
            'dsa-ui/manual/portfolio',
            'dsa-ui/manual/backtest',
            'dsa-ui/manual/settings-login',
          ],
        },
        'dsa-ui/redesign-proposal',
        'dsa-ui/development-plan',
        'dsa-ui/task-tracker',
      ],
    },
  ],
};

export default sidebars;
