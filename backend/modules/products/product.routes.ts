import { FastifyInstance } from 'fastify';
import { productController } from './product.controller';
import { authenticate } from '../../middlewares/auth';
import { resolveTenant } from '../../middlewares/tenant';
import { requirePermission } from '../../middlewares/rbac';

export async function productRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', resolveTenant);

  fastify.get('/', { preHandler: [requirePermission('products:read')] }, productController.listProducts.bind(productController));
  fastify.get('/:id', { preHandler: [requirePermission('products:read')] }, productController.getProductById.bind(productController));
  fastify.post('/', { preHandler: [requirePermission('products:manage')] }, productController.createProduct.bind(productController));
  fastify.patch('/:id', { preHandler: [requirePermission('products:manage')] }, productController.updateProduct.bind(productController));
  fastify.delete('/:id', { preHandler: [requirePermission('products:manage')] }, productController.deleteProduct.bind(productController));

  fastify.get('/categories', { preHandler: [requirePermission('products:read')] }, productController.listCategories.bind(productController));
  fastify.post('/categories', { preHandler: [requirePermission('categories:manage')] }, productController.createCategory.bind(productController));
}
