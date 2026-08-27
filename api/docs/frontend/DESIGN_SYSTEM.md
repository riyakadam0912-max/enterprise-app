# Enterprise Frontend Design System

## Architecture

```
src/
├── components/
│   ├── ui/
│   ├── forms/
│   ├── tables/
│   ├── modals/
│   ├── charts/
│   ├── layout/
│   ├── feedback/
│   ├── guards/
│   ├── badges/
│   ├── loaders/
│   ├── empty-states/
│   ├── typography/
│   └── navigation/
├── hooks/
├── lib/
├── providers/
├── theme/
├── constants/
├── types/
├── styles/
└── modules/
```

## Core Providers

- `DesignSystemProvider` composes theme, toast, and modal providers.
- `ThemeProvider` supports `light`, `dark`, and `system` modes.
- `ToastProvider` exposes global toast helpers with queueing and auto-dismiss.
- `ModalProvider` exposes `openModal()` for confirm, warning, success, fullscreen, drawer, and sheet flows.

## Design Tokens

Central tokens live in `src/constants/design-tokens.ts` and are mirrored in `app/globals.css`.

- Colors: background, surface, foreground, primary, success, warning, danger, info
- Radius: sm through 2xl
- Shadows: sm, md, lg
- Z-index: dropdown, sticky, modal, toast, overlay

## Reusable Components

### UI
- `Button`
- `Input`
- `Textarea`
- `Select`
- `Checkbox`
- `Radio`
- `Card`

### Forms
- `FormWrapper`
- `FormInput`
- `FormSelect`
- `FormTextarea`
- `FormDatePicker`
- `FormCheckbox`
- `FormRadio`
- `FormFileUpload`
- `FormCurrencyInput`
- `FormPhoneInput`

### Tables
- `DataTable`
  - sorting
  - filtering
  - search
  - row selection
  - bulk actions
  - column visibility
  - export CSV/XLSX
  - loading / empty states
  - server-side pagination support

### Modals
- `Dialog`
- `openModal()` / `closeModal()`

### Feedback
- `toast.success()`
- `toast.error()`
- `toast.warning()`
- `toast.info()`

### Guards
- `RoleGuard`
- `PermissionGuard`

### Badges
- `StatusBadge`

### Loaders
- `Skeleton`
- `TableSkeleton`
- `CardSkeleton`
- `PageLoader`
- `FormLoader`
- `ButtonLoader`

### Empty States
- `EmptyState`

### Layout
- `AppLayout`
- `PageHeader`
- `DashboardCard`
- `Breadcrumbs`

### Typography
- `Heading`
- `Text`
- `Label`
- `Caption`

### Navigation
- `SearchBar`
- `FilterPanel`

### Charts
- `ChartShell`
- `EnterpriseLineChart`
- `EnterpriseBarChart`
- `EnterpriseAreaChart`
- `EnterprisePieChart`
- `KpiCard`

## Usage Examples

### Table
```tsx
<DataTable
  columns={columns}
  data={rows}
  exportFileName="employees"
  rowActions={(row) => <DropdownMenu.Item>Edit</DropdownMenu.Item>}
/>
```

### Form
```tsx
const form = useForm<FormValues>({ resolver: zodResolver(schema) });

<FormWrapper form={form} onSubmit={onSubmit} title="Create Employee">
  <FormInput name="name" label="Name" />
  <FormSelect name="role" label="Role" options={roleOptions} />
</FormWrapper>
```

### Modal
```tsx
openModal({
  type: 'confirm',
  title: 'Delete Employee',
  description: 'This action cannot be undone',
  destructive: true,
  onConfirm: async () => deleteEmployee(),
});
```

### Guard
```tsx
<RoleGuard permissions={["employee.create"]}>
  <Button>Create Employee</Button>
</RoleGuard>
```

## Accessibility Standards

- Keyboard-accessible focus states across inputs, buttons, tables, and dialogs
- ARIA labeling for dialog, toast, and table controls
- Visible focus rings and minimum contrast-safe semantic color pairings
- Screen-reader-friendly empty/loading states

## Performance Notes

- `DataTable` supports server-side pagination and can be extended with virtualization
- Providers are isolated to reduce prop drilling
- UI primitives are small and reusable to improve code splitting

## Migration Guidance

Migrate page-by-page:
1. Replace ad hoc buttons, inputs, and cards with UI primitives.
2. Replace custom list views with `DataTable`.
3. Replace one-off modals with `Dialog` or `openModal()`.
4. Replace ad hoc empty/loading states with shared components.
5. Wrap protected sections in `RoleGuard` or `PermissionGuard`.

## Notes

The design system is intentionally layered so modules can adopt it incrementally without a full rewrite.
