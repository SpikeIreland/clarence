import { redirect } from 'next/navigation'

// Training content has moved to /products/training
export default function TrainingRedirect() {
  redirect('/products/training')
}
