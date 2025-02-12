import React, { memo, useMemo } from 'react'; // ^18.0.0
import { View, Text, StyleSheet } from 'react-native'; // 0.71+
import { VictoryPie, VictoryLabel, VictoryTooltip } from 'victory-native'; // ^36.0.0
import { Investment } from '../../types/models';
import Card from '../common/Card';
import { useInvestments } from '../../hooks/useInvestments';
import { useTheme } from '../../hooks/useTheme';

interface PortfolioChartProps {
  width?: number;
  height?: number;
  showLabels?: boolean;
  animationDuration?: number;
  accessible?: boolean;
  accessibilityLabel?: string;
}

interface ChartData {
  type: string;
  value: number;
  color: string;
  percentage: number;
  label: string;
  accessibilityLabel: string;
}

const PortfolioChart: React.FC<PortfolioChartProps> = memo(({
  width = 300,
  height = 300,
  showLabels = true,
  animationDuration = 1000,
  accessible = true,
  accessibilityLabel = 'Investment Portfolio Allocation Chart'
}) => {
  const { theme } = useTheme();
  const { allocation, loadingStates, errors } = useInvestments();

  const chartData = useMemo(() => {
    if (!allocation?.assetClasses) return [];

    const data: ChartData[] = Object.entries(allocation.assetClasses).map(([type, data]) => ({
      type,
      value: data.value,
      color: getAssetColor(type, theme.colors.chart),
      percentage: data.percentage,
      label: `${type}\n${(data.percentage * 100).toFixed(1)}%`,
      accessibilityLabel: `${type} represents ${(data.percentage * 100).toFixed(1)} percent of portfolio`
    }));

    return data.sort((a, b) => b.value - a.value);
  }, [allocation, theme]);

  const totalValue = useMemo(() => 
    chartData.reduce((sum, item) => sum + item.value, 0),
    [chartData]
  );

  if (loadingStates.allocation) {
    return (
      <Card accessible={accessible}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.message, { color: theme.colors.text.secondary }]}>
            Loading portfolio data...
          </Text>
        </View>
      </Card>
    );
  }

  if (errors.allocation) {
    return (
      <Card accessible={accessible}>
        <View style={styles.errorContainer}>
          <Text style={[styles.message, { color: theme.colors.status.error }]}>
            Unable to load portfolio data
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card 
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      style={styles.container}
    >
      <View style={[styles.chartContainer, { width, height }]}>
        <VictoryPie
          data={chartData}
          x="type"
          y="value"
          width={width}
          height={height}
          padding={35}
          innerRadius={70}
          labelRadius={90}
          colorScale={chartData.map(d => d.color)}
          labels={({ datum }) => showLabels ? datum.label : ''}
          labelComponent={
            <VictoryLabel
              style={{
                fill: theme.colors.text.primary,
                fontSize: theme.typography.fontSize.sm
              }}
            />
          }
          events={[{
            target: "data",
            eventHandlers: {
              onPress: () => ({
                target: "labels",
                mutation: (props) => ({
                  active: !props.active
                })
              })
            }
          }]}
          animate={{
            duration: animationDuration,
            onLoad: { duration: animationDuration }
          }}
        />
        <View style={styles.centerLabel}>
          <Text style={[styles.totalValue, { color: theme.colors.text.primary }]}>
            ${totalValue.toLocaleString()}
          </Text>
          <Text style={[styles.totalLabel, { color: theme.colors.text.secondary }]}>
            Total Value
          </Text>
        </View>
      </View>
    </Card>
  );
});

const getAssetColor = (assetType: string, chartColors: Record<string, string>) => {
  const colorMap: Record<string, string> = {
    Stocks: chartColors.primary,
    Bonds: chartColors.secondary,
    Cash: chartColors.tertiary,
    RealEstate: chartColors.positive,
    Commodities: chartColors.negative,
    Other: chartColors.neutral
  };
  return colorMap[assetType] || chartColors.neutral;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  chartContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center'
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center'
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '600'
  },
  totalLabel: {
    fontSize: 14
  },
  loadingContainer: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center'
  },
  errorContainer: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center'
  },
  message: {
    fontSize: 16
  }
});

export default PortfolioChart;