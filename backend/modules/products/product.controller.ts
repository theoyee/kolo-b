import { FastifyRequest, FastifyReply } from 'fastify';
import { productService } from './product.service';
import { createProductSchema, updateProductSchema, createCategorySchema } from './product.schemas';

export class ProductController {
  async listProducts(request: FastifyRequest, reply: FastifyReply) {
    const result = await productService.listProducts(request.tenant!.businessId, request.query);
    return reply.status(200).send({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  }

  async getProductById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await productService.getProductById(request.tenant!.businessId, id);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async createProduct(request: FastifyRequest, reply: FastifyReply) {
    const input = createProductSchema.parse(request.body);
    const result = await productService.createProduct(
      request.tenant!.businessId,
      request.user!.userId,
      input
    );
    return reply.status(201).send({
      success: true,
      message: 'Product created successfully',
      data: result,
    });
  }

  async updateProduct(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const input = updateProductSchema.parse(request.body);
    const result = await productService.updateProduct(
      request.tenant!.businessId,
      id,
      request.user!.userId,
      input
    );
    return reply.status(200).send({
      success: true,
      message: 'Product updated successfully',
      data: result,
    });
  }

  async deleteProduct(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await productService.deleteProduct(
      request.tenant!.businessId,
      id,
      request.user!.userId
    );
    return reply.status(200).send(result);
  }

  async listCategories(request: FastifyRequest, reply: FastifyReply) {
    const result = await productService.listCategories(request.tenant!.businessId);
    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  async createCategory(request: FastifyRequest, reply: FastifyReply) {
    const input = createCategorySchema.parse(request.body);
    const result = await productService.createCategory(
      request.tenant!.businessId,
      request.user!.userId,
      input
    );
    return reply.status(201).send({
      success: true,
      message: 'Category created successfully',
      data: result,
    });
  }
}

export const productController = new ProductController();
