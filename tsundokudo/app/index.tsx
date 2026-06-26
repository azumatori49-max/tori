import { Redirect } from 'expo-router';

// ルート "/" は最初のタブ（レポート一覧）へリダイレクト
export default function Index() {
  return <Redirect href="/reports" />;
}
