import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

export default function Home(): ReactNode {
  return (
    <Layout title="DSA Docs" description="Daily Stock Analysis 文档中心">
      <main className={styles.heroBanner}>
        <div className="container">
          <Heading as="h1" className={styles.title}>
            Daily Stock Analysis 文档中心
          </Heading>
          <p className={styles.subtitle}>基于 Docusaurus 构建，集中管理 dsa-ui 重构文档与操作手册。</p>
          <div className={styles.actions}>
            <Link className="button button--primary button--lg" to="/docs/intro">
              进入文档首页
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/dsa-ui/user-manual">
              查看操作手册
            </Link>
          </div>
        </div>
      </main>
    </Layout>
  );
}
