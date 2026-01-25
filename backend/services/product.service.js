const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { deletePhotosByUrls } = require('./photo.service');
const RazorpaySyncService = require('./razorpay-sync.service');

/**
 * Product Service
 * Handles product retrieval, rating processing, and product lifecycle management.
 */

class ProductService {
    /**
     * Get all products with dynamic ratings and pagination
     */
    static async getAllProducts({ page = 1, limit = 15, search = '', category = 'all', sortBy = 'newest' } = {}) {
        const offset = (page - 1) * limit;

        // Parallel requests: Products Query + Inventory Stats
        // 1. Build Products Query
        let query = supabase
            .from('products')
            .select('*, variants:product_variants(*)', { count: 'exact' });

        if (search) {
            query = query.ilike('title', `%${search}%`);
        }

        if (category && category !== 'all') {
            query = query.eq('category', category);
        }

        switch (sortBy) {
            case 'priceLowHigh':
                query = query.order('price', { ascending: true });
                break;
            case 'priceHighLow':
                query = query.order('price', { ascending: false });
                break;
            case 'newest':
            default:
                query = query.order('created_at', { ascending: false });
                break;
        }

        const productsPromise = query
            .range(offset, offset + limit - 1);

        // 2. Build Stats Queries (Global alerts across all inventory)
        // Note: These definitions use the user's criteria:
        // - Out of Stock: inventory == 0
        // - Critical: inventory < 15 (excluding 0 if we want distinct, but usually "below 15" implies 0-14)
        // - Low: inventory < 50 (usually 15-49 if distinct, but "below 50" covers all)
        // I will return raw counts of matching criteria, frontend handles overlap display logic.
        const statsPromise = Promise.all([
            supabase.from('products').select('id', { count: 'exact', head: true }).eq('inventory', 0),
            supabase.from('products').select('id', { count: 'exact', head: true }).gt('inventory', 0).lt('inventory', 15),
            supabase.from('products').select('id', { count: 'exact', head: true }).gte('inventory', 15).lt('inventory', 50)
        ]);

        const [{ data: products, error, count }, statsResults] = await Promise.all([
            productsPromise,
            statsPromise
        ]);

        if (error) throw error;

        const outOfStockCount = statsResults[0].count || 0;
        const criticalStockCount = statsResults[1].count || 0;
        const lowStockCount = statsResults[2].count || 0;

        if (!products || products.length === 0) {
            return {
                products: [],
                total: 0,
                stats: { outOfStockCount, criticalStockCount, lowStockCount }
            };
        }

        // Get IDs of fetched products to optimize review and config fetching
        const productIds = products.map(p => p.id);

        // Calculate isNew
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        products.forEach(product => {
            const createdDateStr = product.createdAt || product.created_at;
            product.isNew = createdDateStr ? new Date(createdDateStr) >= thirtyDaysAgo : false;
        });

        return {
            products,
            total: count,
            stats: { outOfStockCount, criticalStockCount, lowStockCount }
        };
    }

    /**
     * Get single product by ID with variants
     */
    static async getProductById(id) {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        // Fetch variants for this product
        const { data: variants, error: variantError } = await supabase
            .from('product_variants')
            .select('*')
            .eq('product_id', id)
            .order('size_value', { ascending: true });

        if (!variantError && variants) {
            data.variants = variants;
            // Find default variant
            const defaultVariant = variants.find(v => v.is_default) || variants[0];
            data.defaultVariant = defaultVariant || null;
        } else {
            data.variants = [];
            data.defaultVariant = null;
        }

        // rating, ratingCount and reviewCount are now part of the product record
        // No need to fetch and calculate on every request.
        if (!data.rating) data.rating = 0;
        if (!data.ratingCount) data.ratingCount = 0;
        if (!data.reviewCount) data.reviewCount = 0;

        // Fetch Delivery Configs (Product and Variant level)
        const { data: deliveryConfigs, error: configError } = await supabase
            .from('delivery_configs')
            .select('*')
            .eq('is_active', true)
            .or(`product_id.eq.${id},variant_id.in.(${variants && variants.length > 0 ? variants.map(v => v.id).join(',') : '00000000-0000-0000-0000-000000000000'})`);

        if (!configError && deliveryConfigs) {
            // Attach product-level config
            const productConfig = deliveryConfigs.find(c => c.scope === 'PRODUCT' && c.product_id === id);
            data.delivery_config = productConfig || null;

            // Attach variant-level configs to variants
            if (data.variants && data.variants.length > 0) {
                data.variants = data.variants.map(v => {
                    const variantConfig = deliveryConfigs.find(c => c.scope === 'VARIANT' && c.variant_id === v.id);
                    return { ...v, delivery_config: variantConfig || null };
                });
            }
        }


        // Calculate isNew
        const createdDateStr = data.createdAt || data.created_at;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        data.isNew = createdDateStr ? new Date(createdDateStr) >= thirtyDaysAgo : false;

        return data;
    }

    /**
     * Create product
     * @param {Object} productData - Product data including variant_mode
     */
    static async createProduct(productData) {
        // Extract delivery config if present
        let deliveryConfig = null;
        if (productData.delivery_config) {
            deliveryConfig = productData.delivery_config;
            delete productData.delivery_config;
        }

        // Normalize Return Policy fields for database
        if (productData.isReturnable !== undefined) {
            productData.is_returnable = productData.isReturnable;
            delete productData.isReturnable;
        }
        if (productData.returnDays !== undefined) {
            productData.return_days = productData.returnDays;
            delete productData.returnDays;
        }
        if (productData.isNew !== undefined) {
            productData.is_new = productData.isNew;
            delete productData.isNew;
        }
        if (productData.createdAt !== undefined) {
            productData.created_at = productData.createdAt;
            delete productData.createdAt;
        }
        if (productData.updatedAt !== undefined) {
            productData.updated_at = productData.updatedAt;
            delete productData.updatedAt;
        }

        // DEPRECATED: delivery_charge is no longer used directly on product
        // We ensure it's removed from payload to avoid schema errors if column remains
        if (productData.deliveryCharge !== undefined) {
            delete productData.deliveryCharge;
        }
        if (productData.delivery_charge !== undefined) {
            delete productData.delivery_charge;
        }

        const { data, error } = await supabase
            .from('products')
            .insert([productData])
            .select()
            .single();

        if (error) throw error;

        // Handle Delivery Config Creation
        if (deliveryConfig && data?.id) {
            try {
                const { error: configError } = await supabase
                    .from('delivery_configs')
                    .insert([{
                        ...deliveryConfig,
                        product_id: data.id,
                        scope: 'PRODUCT',
                        variant_id: null
                    }]);

                if (configError) {
                    logger.error('Error creating delivery config for new product:', configError);
                    // We don't throw here to avoid failing entire product creation, but logging is critical
                }
            } catch (err) {
                logger.error('Exception creating delivery config:', err);
            }
        }

        // Note: Variants are created separately via ProductVariantService
        // We only trigger sync when variants are added/updated

        return data;
    }

    /**
     * Update product
     */
    static async updateProduct(id, productData) {
        // Normalize Return Policy fields for database
        if (productData.isReturnable !== undefined) {
            productData.is_returnable = productData.isReturnable;
            delete productData.isReturnable;
        }
        if (productData.returnDays !== undefined) {
            productData.return_days = productData.returnDays;
            delete productData.returnDays;
        }
        if (productData.isNew !== undefined) {
            productData.is_new = productData.isNew;
            delete productData.isNew;
        }
        if (productData.createdAt !== undefined) {
            productData.created_at = productData.createdAt;
            delete productData.createdAt;
        }
        if (productData.updatedAt !== undefined) {
            productData.updated_at = productData.updatedAt;
            delete productData.updatedAt;
        }

        // DEPRECATED: delivery_charge is no longer used directly on product
        if (productData.deliveryCharge !== undefined) {
            delete productData.deliveryCharge;
        }
        if (productData.delivery_charge !== undefined) {
            delete productData.delivery_charge;
        }

        // Extract delivery config if present
        let deliveryConfig = null;
        if (productData.delivery_config) {
            deliveryConfig = productData.delivery_config;
            delete productData.delivery_config;
        }

        const { data, error } = await supabase
            .from('products')
            .update(productData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Handle Delivery Config Update
        if (deliveryConfig) {
            try {
                // Determine if we should update or delete (if explicitly null/empty?)
                // Usually payload contains the config to set.
                // We upsert based on product_id and scope
                const { error: configError } = await supabase
                    .from('delivery_configs')
                    .upsert({
                        ...deliveryConfig,
                        product_id: id,
                        scope: 'PRODUCT',
                        variant_id: null,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'product_id,scope,variant_id' }); // Assuming unique constraint exists

                if (configError) {
                    logger.error('Error updating delivery config for product:', configError);
                }
            } catch (err) {
                logger.error('Exception updating delivery config:', err);
            }
        }

        return data;
    }

    /**
     * Delete product
     */
    static async deleteProduct(id) {
        // 1. Get product to find image URLs
        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('images')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        // 2. Get variants to find variant image URLs
        const { data: variants, error: variantError } = await supabase
            .from('product_variants')
            .select('variant_image_url, razorpay_item_id')
            .eq('product_id', id);

        if (variantError) logger.error('Error fetching variants for deletion:', variantError);

        // 3. Delete product from database (cascade will remove variants data)
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // 4. Collect all images to delete
        const imagesToDelete = [];

        // Add product images
        if (product && product.images && product.images.length > 0) {
            imagesToDelete.push(...product.images);
        }

        // Add variant images
        if (variants && variants.length > 0) {
            variants.forEach(v => {
                if (v.variant_image_url) {
                    imagesToDelete.push(v.variant_image_url);
                }
            });
        }

        // 5. Clean up all images from storage
        if (imagesToDelete.length > 0) {
            // Remove duplicates just in case
            const uniqueImages = [...new Set(imagesToDelete)];
            deletePhotosByUrls(uniqueImages).catch(err =>
                logger.error('Error cleaning up product/variant images:', err)
            );
        }

        // 6. Cleanup Razorpay Items
        if (variants && variants.length > 0) {
            variants.forEach(v => {
                if (v.razorpay_item_id) {
                    RazorpaySyncService.deleteItem(v.razorpay_item_id).catch(err =>
                        logger.error('RAZORPAY_ITEM_DELETE_FAIL', err, { itemId: v.razorpay_item_id })
                    );
                }
            });
        }

        return true;
    }
}

module.exports = ProductService;
