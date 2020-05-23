import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';
import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';

import Category from '../models/Category';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: '';
}
class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionRepository = getCustomRepository(TransactionsRepository);
    const { total } = await transactionRepository.getBalance();

    if (type === 'outcome' && value > total) {
      throw new AppError('No balance');
    }
    const categoryRepository = getRepository(Category);

    let categoryObject = await categoryRepository.findOne({
      where: { title: category },
    });

    if (!categoryObject) {
      const categoryCreate = categoryRepository.create({
        title: category,
      });

      await categoryRepository.save(categoryCreate);

      categoryObject = categoryCreate;
    }

    const transaction = transactionRepository.create({
      title,
      value,
      type,
      category_id: categoryObject.id,
    });

    await transactionRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
