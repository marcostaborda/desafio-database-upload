import { EntityRepository, Repository } from 'typeorm';

import Transaction from '../models/Transaction';

interface Balance {
  income: number;
  outcome: number;
  total: number;
}

@EntityRepository(Transaction)
class TransactionsRepository extends Repository<Transaction> {
  public async getBalance(): Promise<Balance> {
    const { income } = await this.createQueryBuilder('t2')
      .select('SUM(t2.value)', 'income')
      .where("t2.type = 'income'")
      .getRawOne();

    const { outcome } = await this.createQueryBuilder('t2')
      .select('SUM(t2.value)', 'outcome')
      .where("t2.type = 'outcome'")
      .getRawOne();

    const total = income - outcome;

    return { income, outcome, total };
  }
}

export default TransactionsRepository;
