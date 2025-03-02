import {
  DataSource,
  EllipsiesBaseModel,
  EntityTarget,
} from '@similie/ellipsies';
import RiskIndicator from '../models/risk-indicator.model';
import { riskIndicators } from './risk-indicators';

const seedOptions: Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { model: EntityTarget<any>; seeds: Partial<EllipsiesBaseModel>[] }
> = {
  risks: {
    seeds: riskIndicators,
    model: RiskIndicator,
  },
};

export const seedContent = async (seeds: string[], dataSource: DataSource) => {
  for (const seed of seeds) {
    const model = seedOptions[seed];
    if (!model) {
      console.log(`Seed ${seed} not found`);
      continue;
    }
    const repository = dataSource.getRepository(model.model);
    const count = await repository.count();
    if (count) {
      continue;
    }
    const created = repository.create(model.seeds);
    const models = await repository.save(created);
    console.log(`Seeded ${seed}: ${models.length}`);
  }
};
