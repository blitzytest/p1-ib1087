import React, { useCallback, useMemo } from 'react'; // ^18.0.0
import { 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  Text,
  ViewStyle,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform
} from 'react-native'; // 0.71+
import { useDebounce } from 'use-debounce'; // ^9.0.0
import { useTheme } from '../../hooks/useTheme';
import Card from './Card';

// Props interface with strict typing
interface ListProps<T> {
  data: Array<T>;
  renderItem: (item: T) => React.ReactElement;
  style?: ViewStyle;
  loading?: boolean;
  emptyMessage?: string;
  onRefresh?: () => Promise<void>;
  refreshing?: boolean;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  horizontal?: boolean;
  initialNumToRender?: number;
  maxToRenderPerBatch?: number;
  windowSize?: number;
  contentContainerStyle?: ViewStyle;
  testID?: string;
  accessible?: boolean;
  accessibilityLabel?: string;
}

// Memoized list component for optimal performance
const List = React.memo(<T extends any>(props: ListProps<T>) => {
  const {
    data,
    renderItem,
    style,
    loading = false,
    emptyMessage = 'No items to display',
    onRefresh,
    refreshing = false,
    onEndReached,
    onEndReachedThreshold = 0.5,
    onScroll,
    horizontal = false,
    initialNumToRender = 10,
    maxToRenderPerBatch = 5,
    windowSize = 5,
    contentContainerStyle,
    testID = 'list-component',
    accessible = true,
    accessibilityLabel = 'Scrollable list'
  } = props;

  // Get current theme
  const { theme } = useTheme();

  // Create memoized styles
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Debounced scroll handler for performance
  const [debouncedScroll] = useDebounce(onScroll, 100);

  // Memoized item renderer with Card wrapper
  const renderItemWrapper = useCallback((item: T) => (
    <Card 
      style={styles.itemContainer}
      accessible={true}
      accessibilityRole="listitem"
    >
      {renderItem(item)}
    </Card>
  ), [renderItem, styles.itemContainer]);

  // Loading state
  if (loading) {
    return (
      <ActivityIndicator
        testID="list-loading"
        style={styles.loadingContainer}
        size="large"
        color={theme.colors.brand.primary}
        accessibilityLabel="Loading content"
      />
    );
  }

  // Empty state
  if (!loading && (!data || data.length === 0)) {
    return (
      <Text
        style={styles.emptyMessage}
        testID="list-empty"
        accessibilityRole="text"
        accessibilityLabel={emptyMessage}
      >
        {emptyMessage}
      </Text>
    );
  }

  // Render optimized FlatList
  return (
    <FlatList
      data={data}
      renderItem={({ item }) => renderItemWrapper(item)}
      style={[styles.container, style]}
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      keyExtractor={(item, index) => `list-item-${index}`}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      onRefresh={onRefresh}
      refreshing={refreshing}
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      onScroll={debouncedScroll}
      horizontal={horizontal}
      initialNumToRender={initialNumToRender}
      maxToRenderPerBatch={maxToRenderPerBatch}
      windowSize={windowSize}
      removeClippedSubviews={Platform.OS !== 'web'}
      testID={testID}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="list"
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
        autoscrollToTopThreshold: 10
      }}
      // Performance optimizations
      getItemLayout={(_, index) => ({
        length: 100, // Estimated item height
        offset: 100 * index,
        index,
      })}
    />
  );
});

// Create memoized styles using theme values
const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
    ...Platform.select({
      web: {
        minHeight: 200
      }
    })
  },
  itemContainer: {
    marginVertical: theme.spacing.xs,
    backgroundColor: theme.colors.background.card,
    borderRadius: 8,
  },
  emptyMessage: {
    textAlign: 'center',
    padding: theme.spacing.lg,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.regular,
  },
  separator: {
    height: theme.spacing.sm,
  }
});

// Export memoized component
export default List;