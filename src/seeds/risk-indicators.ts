import RiskIndicator from '../models/risk-indicator.model';
import {
  RiskColorMap,
  RiskIndicatorMap,
  RiskIndicatorMapValue,
} from '../utils';

export const riskIndicators: Partial<RiskIndicator>[] = [
  {
    paramKey: 'gust',
    name: 'Wind Gust',
    description: 'No Discernable Threat to Life and Property from High Wind.',
    severity: RiskIndicatorMap.noThreat,
    color: RiskColorMap.noThreat,
    severityValue: RiskIndicatorMapValue.noThreat,
    floor: 0,
    ceil: 4.47,
  },

  {
    paramKey: 'gust',
    name: 'Wind Gust',
    description: 'A Very Low Threat to Life and Property from High Wind.',
    severity: RiskIndicatorMap.vLow,
    color: RiskColorMap.vLow,
    severityValue: RiskIndicatorMapValue.vLow,
    floor: 4.47,
    ceil: 8.94,
  },

  {
    paramKey: 'gust',
    name: 'Wind Gust',
    description: 'A Low Threat to Life and Property from High Wind.',
    severity: RiskIndicatorMap.low,
    color: RiskColorMap.low,
    severityValue: RiskIndicatorMapValue.low,
    floor: 8.94,
    ceil: 11.17,
  },

  {
    paramKey: 'gust',
    name: 'Wind Gust',
    description: 'A Moderate Threat to Life and Property from High Wind.',
    severity: RiskIndicatorMap.moderate,
    color: RiskColorMap.moderate,
    severityValue: RiskIndicatorMapValue.moderate,
    floor: 11.17,
    ceil: 17.43,
  },

  {
    paramKey: 'gust',
    name: 'Wind Gust',
    description: 'A High Threat to Life and Property from High Wind.',
    severity: RiskIndicatorMap.high,
    color: RiskColorMap.high,
    severityValue: RiskIndicatorMapValue.high,
    floor: 17.43,
    ceil: 25.48,
  },
  {
    paramKey: 'gust',
    name: 'Wind Gust',
    description: 'An Extreme Threat to Life and Property from High Wind.',
    severity: RiskIndicatorMap.vHigh,
    color: RiskColorMap.vHigh,
    severityValue: RiskIndicatorMapValue.vHigh,
    floor: 25.48,
    ceil: 9999,
  },
];
