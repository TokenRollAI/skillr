import SkillDetailPage from './skill-detail';

export async function generateStaticParams() {
  return [{ ns: '_', name: '_' }];
}

export default function Page() {
  return <SkillDetailPage />;
}
