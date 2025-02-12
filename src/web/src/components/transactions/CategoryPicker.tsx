import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Modal, ModalProps } from '../common/Modal';
import { useTheme } from '../../hooks/useTheme';

// Constants for performance optimization
const DEBOUNCE_DELAY = 300;
const MINIMUM_SEARCH_LENGTH = 2;
const ITEMS_PER_PAGE = 50;

// Category data structure
interface Category {
  id: string;
  name: string;
  icon?: string;
  parentId?: string;
}

// Component props interface
interface CategoryPickerProps {
  visible: boolean;
  onClose: () => void;
  initialCategory?: string;
  onCategorySelect: (category: string) => void;
  isLoading?: boolean;
  onCreateCategory?: (name: string) => Promise<void>;
  customStyles?: object;
  testID?: string;
}

// Custom hook for category management
const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Memoized search handler with debouncing
  const handleSearch = useCallback((text: string) => {
    if (text.length < MINIMUM_SEARCH_LENGTH) {
      setFilteredCategories(categories);
      return;
    }

    const normalizedSearch = text.toLowerCase().trim();
    const filtered = categories.filter(category =>
      category.name.toLowerCase().includes(normalizedSearch)
    );
    setFilteredCategories(filtered);
  }, [categories]);

  // Initialize categories
  useEffect(() => {
    const loadCategories = async () => {
      setIsLoading(true);
      try {
        // Mock categories for demonstration
        const defaultCategories: Category[] = [
          { id: '1', name: 'Food & Dining' },
          { id: '2', name: 'Shopping' },
          { id: '3', name: 'Transportation' },
          { id: '4', name: 'Bills & Utilities' },
          { id: '5', name: 'Entertainment' },
        ];
        setCategories(defaultCategories);
        setFilteredCategories(defaultCategories);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCategories();
  }, []);

  return {
    categories,
    filteredCategories,
    searchText,
    handleSearch,
    isLoading,
    error,
  };
};

export const CategoryPicker: React.FC<CategoryPickerProps> = ({
  visible,
  onClose,
  initialCategory,
  onCategorySelect,
  isLoading: externalLoading,
  onCreateCategory,
  customStyles,
  testID,
}) => {
  const { theme } = useTheme();
  const {
    filteredCategories,
    handleSearch,
    isLoading: categoriesLoading,
    error,
  } = useCategories();

  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    initialCategory
  );
  const [searchText, setSearchText] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Debounced search handler
  const debouncedSearch = useCallback(
    (text: string) => {
      const timeoutId = setTimeout(() => handleSearch(text), DEBOUNCE_DELAY);
      return () => clearTimeout(timeoutId);
    },
    [handleSearch]
  );

  // Handle search input changes
  const onSearchChange = useCallback(
    (text: string) => {
      setSearchText(text);
      debouncedSearch(text);
    },
    [debouncedSearch]
  );

  // Handle category selection
  const handleCategorySelect = useCallback(
    (category: Category) => {
      setSelectedCategory(category.id);
      onCategorySelect(category.name);
      onClose();
    },
    [onCategorySelect, onClose]
  );

  // Handle new category creation
  const handleCreateCategory = useCallback(async () => {
    if (!onCreateCategory || !searchText.trim()) return;

    setIsCreatingCategory(true);
    try {
      await onCreateCategory(searchText.trim());
      onCategorySelect(searchText.trim());
      onClose();
    } catch (err) {
      console.error('Failed to create category:', err);
    } finally {
      setIsCreatingCategory(false);
    }
  }, [searchText, onCreateCategory, onCategorySelect, onClose]);

  // Render category item
  const renderItem = useCallback(
    ({ item }: { item: Category }) => (
      <TouchableOpacity
        style={[
          styles.categoryItem,
          selectedCategory === item.id && styles.selectedCategory,
        ]}
        onPress={() => handleCategorySelect(item)}
        accessibilityRole="button"
        accessibilityLabel={`Select category ${item.name}`}
        accessibilityState={{ selected: selectedCategory === item.id }}
      >
        <Text
          style={[
            styles.categoryText,
            { color: theme.colors.text.primary },
            selectedCategory === item.id && { color: theme.colors.brand.primary },
          ]}
        >
          {item.name}
        </Text>
      </TouchableOpacity>
    ),
    [selectedCategory, handleCategorySelect, theme]
  );

  const isLoading = externalLoading || categoriesLoading || isCreatingCategory;

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Select Category"
      containerStyle={[styles.container, customStyles]}
      accessibilityProps={{
        label: 'Category selection dialog',
        hint: 'Search or select a transaction category',
      }}
    >
      <View style={styles.content} testID={testID}>
        <View style={styles.searchContainer}>
          <TextInput
            style={[
              styles.searchInput,
              { backgroundColor: theme.colors.background.input },
            ]}
            placeholder="Search categories..."
            value={searchText}
            onChangeText={onSearchChange}
            accessibilityLabel="Search transaction categories"
            accessibilityHint="Type to search for categories"
            autoFocus={Platform.OS === 'web'}
          />
        </View>

        {isLoading ? (
          <ActivityIndicator
            size="large"
            color={theme.colors.brand.primary}
            style={styles.loader}
          />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: theme.colors.status.error }]}>
              Failed to load categories
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredCategories}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            initialNumToRender={ITEMS_PER_PAGE}
            maxToRenderPerBatch={ITEMS_PER_PAGE}
            windowSize={5}
            accessibilityRole="list"
            accessibilityLabel="Categories list"
          />
        )}

        {searchText.trim() && onCreateCategory && (
          <TouchableOpacity
            style={[
              styles.createButton,
              { backgroundColor: theme.colors.brand.primary },
            ]}
            onPress={handleCreateCategory}
            disabled={isCreatingCategory}
            accessibilityRole="button"
            accessibilityLabel={`Create new category ${searchText}`}
          >
            <Text style={[styles.createButtonText, { color: theme.colors.text.inverse }]}>
              Create "{searchText}"
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    maxHeight: '80%',
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: {
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  categoryItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  selectedCategory: {
    backgroundColor: 'rgba(0, 166, 164, 0.1)',
  },
  categoryText: {
    fontSize: 16,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  createButton: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export type { CategoryPickerProps };