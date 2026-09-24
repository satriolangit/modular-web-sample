import axios from 'axios';
import type { Deps } from '@arsi/container';

import { ProductDeleteDialog } from './components/ProductDeleteDialog';
import en from './i18n/en.json';
import id from './i18n/id.json';
import { productModals } from './modals';
import { ProductCreatePage } from './pages/ProductCreatePage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ProductEditPage } from './pages/ProductEditPage';
import { ProductListPage } from './pages/ProductListPage';

let initialized = false;

export default async function init(deps: Deps): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;

  deps.i18n.addResourceBundle('en', 'product-management', en, true, true);
  deps.i18n.addResourceBundle('id', 'product-management', id, true, true);

  const productClient = axios.create({
    baseURL: deps.config.apiBase,
    timeout: 8000,
  });
  deps.apiRegistry.register('product', productClient);

  deps.menu.register({
    path: '/products',
    label: 'menu.products',
    namespace: 'product-management',
    order: 20,
  });

  deps.routes.add({
    path: '/products',
    element: <ProductListPage />,
    meta: { group: 'product', module: 'product-management' },
  });

  deps.routes.add({
    path: '/products/new',
    element: <ProductCreatePage />,
    meta: { group: 'product', module: 'product-management' },
  });

  deps.routes.add({
    path: '/products/:id',
    element: <ProductDetailPage />,
    meta: { group: 'product', module: 'product-management' },
  });

  deps.routes.add({
    path: '/products/:id/edit',
    element: <ProductEditPage />,
    meta: { group: 'product', module: 'product-management' },
  });

  deps.modal.register(productModals.deleteConfirm, ProductDeleteDialog);
}
