import {
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';

export type QueryFilters<T> =
  | Partial<{
      select: FindOptionsSelect<T>;
      relations: FindOptionsRelations<T>;
      where: FindOptionsWhere<T> | FindOptionsWhere<T>[];
    }>
  | undefined;

export default abstract class QueryService {
  findBy<T extends ObjectLiteral>(
    repository: Repository<ObjectLiteral>,
    key: keyof T,
    value: T[keyof T],
    filters?: QueryFilters<T>,
  ) {
    return repository.findOne({
      select: filters?.select,
      relations: filters?.relations,
      where: {
        [key]: value,
        ...filters?.where,
      } as FindOptionsWhere<T>,
    }) as Promise<T | null>;
  }

  findManyBy<T extends ObjectLiteral & { deletedAt?: Date }>(
    repository: Repository<ObjectLiteral>,
    key: keyof T,
    value: T[keyof T],
    filters?: QueryFilters<T>,
  ) {
    return repository.find({
      select: filters?.select,
      relations: filters?.relations,
      where: {
        [key]: value,
        ...filters?.where,
      } as FindOptionsWhere<T>,
    }) as Promise<T[]>;
  }

  existsBy<T extends ObjectLiteral & { deletedAt?: Date }>(
    repository: Repository<T>,
    key: keyof T,
    value: T[keyof T],
    filters?: QueryFilters<T>,
  ) {
    return repository.exists({
      select: filters?.select,
      relations: filters?.relations,
      where: {
        [key]: value,
        ...filters?.where,
      } as FindOptionsWhere<T>,
    });
  }
}
