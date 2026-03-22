import NamespaceDetailPage from './namespace-detail';

export async function generateStaticParams() {
  return [{ name: '_' }];
}

export default function Page() {
  return <NamespaceDetailPage />;
}
