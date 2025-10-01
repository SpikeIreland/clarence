export default function TestPage() {
  return <h1>Test</h1>
git add app/test
git commit -m "Add test route"
git push origin main
cat > app/test/page.tsx << 'EOF'
export default function TestPage() {
  return <h1>Test</h1>
}
