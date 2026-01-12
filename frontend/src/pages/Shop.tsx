import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { ProductQuickView } from "@/components/ProductQuickView";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Product } from "@/types";
import { productService } from "@/services/product.service";
import { categoryService } from "@/services/category.service";

/**
 * Custom hook for debouncing a value
 * PERFORMANCE: Prevents API refetches on every keystroke
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const Shop = () => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [category, setCategory] = useState("all");
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(
    null
  );

  // PERFORMANCE: Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // SERVER-SIDE PAGINATION: Use useInfiniteQuery
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["products", debouncedSearchQuery, category, sortBy],
    queryFn: async ({ pageParam = 1 }) => {
      // Use the new getAll signature which returns { products, total, stats }
      const response = await productService.getAll({
        page: pageParam,
        limit: 12, // Load 12 products per page
        search: debouncedSearchQuery,
        category: category,
        sortBy: sortBy,
      });
      return response;
    },
    getNextPageParam: (lastPage, allPages) => {
      const loadedProducts = allPages.flatMap((p) => p.products).length;
      if (loadedProducts < lastPage.total) {
        return allPages.length + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  // Flatten pages for rendering
  const allProducts = data?.pages.flatMap((page) => page.products) || [];

  // Fetch categories from backend
  const { data: categoriesData = [] } = useQuery({
    queryKey: ["categories", "product"],
    queryFn: () => categoryService.getAll("product"),
  });

  // Build categories array with "all" option
  const categories = ["all", ...categoriesData.map(c => c.name)];

  return (
    <div className="min-h-screen bg-background py-8">
      <ProductQuickView
        product={quickViewProduct}
        open={quickViewProduct !== null}
        onOpenChange={(open) => !open && setQuickViewProduct(null)}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t("nav.shop")}</h1>
          <p className="text-muted-foreground">
            Browse our collection of pure, organic cow products
          </p>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-card rounded-lg p-4 shadow-soft mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t("products.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat === "all" ? "All Categories" : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t("products.newest")}</SelectItem>
                <SelectItem value="priceLowHigh">
                  {t("products.priceLowHigh")}
                </SelectItem>
                <SelectItem value="priceHighLow">
                  {t("products.priceHighLow")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-96 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : allProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {allProducts.map((product) => (
                <div key={product.id} className="w-full max-w-[320px] mx-auto">
                  <ProductCard
                    product={product}
                    onQuickView={setQuickViewProduct}
                  />
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {hasNextPage && (
              <div className="mt-12 text-center">
                <Button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  variant="outline"
                  size="lg"
                >
                  {isFetchingNextPage ? "Loading more..." : "Load More Products"}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-xl text-muted-foreground">
              No products found matching your criteria
            </p>
          </div>
        )}
      </div>
    </div>
  );
};


export default Shop;
