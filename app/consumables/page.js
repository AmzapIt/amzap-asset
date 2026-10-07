import { redirect } from 'next/navigation';

export default function ConsumablesPage() {
  redirect('/accessories?tab=consumables');
}
