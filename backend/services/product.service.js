const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { deletePhotosByUrls } = require('./photo.service');

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
            .select('*', { count: 'exact' });

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
                query = query.order('createdAt', { ascending: false });
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

        // Get IDs of fetched products to optimize review fetching
        const productIds = products.map(p => p.id);

        // Fetch reviews only for relevant products
        const { data: relevantReviews, error: reviewError } = await supabase
            .from('reviews')
            .select('product_id, rating')
            .in('product_id', productIds);

        if (!reviewError && relevantReviews && relevantReviews.length > 0) {
            const ratingsByProduct = {};
            relevantReviews.forEach(review => {
                if (!ratingsByProduct[review.product_id]) {
                    ratingsByProduct[review.product_id] = { total: 0, count: 0 };
                }
                ratingsByProduct[review.product_id].total += review.rating;
                ratingsByProduct[review.product_id].count += 1;
            });

            products.forEach(product => {
                const productRatings = ratingsByProduct[product.id];
                if (productRatings && productRatings.count > 0) {
                    product.rating = Number((productRatings.total / productRatings.count).toFixed(1));
                    product.ratingCount = productRatings.count;
                    product.reviewCount = productRatings.count;
                } else {
                    product.rating = product.rating || 0;
                    product.ratingCount = 0;
                    product.reviewCount = 0;
                }
            });
        } else {
            products.forEach(product => {
                product.rating = product.rating || 0;
                product.ratingCount = 0;
                product.reviewCount = 0;
            });
        }

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

        // Fetch reviews
        const { data: reviews, error: reviewError } = await supabase
            .from('reviews')
            .select('rating')
            .eq('product_id', id);

        if (!reviewError && reviews && reviews.length > 0) {
            const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
            const avgRating = totalRating / reviews.length;

            data.rating = Number(avgRating.toFixed(1));
            data.ratingCount = reviews.length;
            data.reviewCount = reviews.length;
        } else {
            if (!data.rating) data.rating = 0;
            data.ratingCount = 0;
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
        const { data, error } = await supabase
            .from('products')
            .insert([productData])
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Update product
     */
    static async updateProduct(id, productData) {
        const { data, error } = await supabase
            .from('products')
            .update(productData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
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
            .select('variant_image_url')
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

        return true;
    }
}

module.exports = ProductService;
