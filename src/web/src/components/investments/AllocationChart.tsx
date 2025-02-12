import React, { useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native'; // ^0.71.0
import { VictoryPie } from 'victory-native'; // ^36.0.0
import { Investment } from '../../types/models';
import { useInvestments } from '../../hooks/useInvestments';

interface AllocationChartProps {
  width: number;
  height: number;
  theme?: {
    colors: {
      primary: string;
      error: string;
      background: string;
      text: string;
    };
  };
}

interface AllocationData {
  type: string;
  percentage: number;
  value: number;
  color: string;
  label: string;
}

const DEFAULT_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const calculateAllocation = (investments: Investment[]): AllocationData[] => {
  if (!investments?.length) return [];

  // Calculate total portfolio value
  const totalValue = investments.reduce((sum, inv) => sum + inv.value, 0);
  if (totalValue === 0) return [];

  // Group investments by type and calculate percentages
  const allocationMap = investments.reduce((acc, inv) => {
    const existing = acc.get(inv.type) || { value: 0, count: 0 };
    acc.set(inv.type, {
      value: existing.value + inv.value,
      count: existing.count + 1
    });
    return acc;
  }, new Map<string, { value: number; count: number }>());

  // Convert to array and calculate percentages
  let allocations = Array.from(allocationMap.entries()).map(([type, data]) => ({
    type,
    value: data.value,
    percentage: (data.value / totalValue) * 100,
    count: data.count
  }));

  // Sort by percentage descending
  allocations.sort((a, b) => b.percentage - a.percentage);

  // Group small allocations (< 1%) into "Other"
  const smallAllocations = allocations.filter(a => a.percentage < 1);
  const mainAllocations = allocations.filter(a => a.percentage >= 1);

  if (smallAllocations.length > 0) {
    const otherValue = smallAllocations.reduce((sum, a) => sum + a.value, 0);
    const otherPercentage = (otherValue / totalValue) * 100;
    mainAllocations.push({
      type: 'Other',
      value: otherValue,
      percentage: otherPercentage,
      count: smallAllocations.length
    });
  }

  // Format data for Victory chart with colors and labels
  return mainAllocations.map((allocation, index) => ({
    type: allocation.type,
    percentage: allocation.percentage,
    value: allocation.value,
    color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    label: `${allocation.type}\n${allocation.percentage.toFixed(1)}%`
  }));
};

export const AllocationChart: React.FC<AllocationChartProps> = ({ 
  width, 
  height,
  theme = {
    colors: {
      primary: '#000',
      error: '#FF0000',
      background: '#FFF',
      text: '#000'
    }
  }
}) => {
  const { holdings: investments, isLoading, error } = useInvestments();

  const allocationData = useMemo(() => 
    calculateAllocation(investments),
    [investments]
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          Failed to load allocation data
        </Text>
      </View>
    );
  }

  if (!allocationData.length) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={[styles.errorText, { color: theme.colors.text }]}>
          No investment data available
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <VictoryPie
        data={allocationData}
        x="type"
        y="percentage"
        width={width}
        height={height}
        colorScale={allocationData.map(d => d.color)}
        innerRadius={70}
        labelRadius={100}
        padAngle={0.5}
        style={{
          labels: {
            fill: theme.colors.text,
            fontSize: 12,
            fontWeight: 'bold'
          }
        }}
        animate={{
          duration: 300,
          onLoad: { duration: 200 }
        }}
        events={[{
          target: "data",
          eventHandlers: {
            onPress: () => null, // Handle slice selection if needed
          }
        }]}
        containerComponent={
          <View 
            accessibilityRole="image"
            accessibilityLabel="Investment Portfolio Allocation Chart"
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row'
  },
  chart: {
    flex: 1,
    minHeight: 200
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center'
  }
});

export default AllocationChart;