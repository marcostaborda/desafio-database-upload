import { getCustomRepository, getRepository, In } from 'typeorm';
import path from 'path';
import fs from 'fs';
import csvParse from 'csv-parse';
import AppError from '../errors/AppError';
import uploadConfig from '../config/upload';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  filename: string;
}

class ImportTransactionsService {
  async execute({ filename }: Request): Promise<Transaction[]> {
    const transactionRepository = getCustomRepository(TransactionsRepository);
    const uploadcsvFilePath = path.join(uploadConfig.directory, filename);

    const csvExist = await fs.promises.stat(uploadcsvFilePath);

    if (!csvExist) {
      throw new AppError('Csv not upload');
    }

    const readCSVStream = fs.createReadStream(uploadcsvFilePath);

    const parseStream = csvParse({
      from_line: 2,
      ltrim: true,
      rtrim: true,
    });
    const parseCSV = readCSVStream.pipe(parseStream);

    const transactions: {
      title: string;
      type: 'income' | 'outcome';
      value: number;
      category: string;
    }[] = [];

    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line;
      transactions.push({ title, type, value, category });
      categories.push(category);
    });
    await new Promise(resolve => parseCSV.on('end', resolve));

    const categoryRepository = getRepository(Category);
    const categoriesExists = await categoryRepository.find({
      where: {
        title: In(categories),
      },
    });

    const existentCategoriesTitles = categoriesExists.map(
      category => category.title,
    );

    const addCategories = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoryRepository.create(
      addCategories.map(title => ({
        title,
      })),
    );

    await categoryRepository.save(newCategories);

    const categoriesValues = [...newCategories, ...categoriesExists];

    const transactionsCreate = transactionRepository.create(
      transactions.map(t => {
        return {
          title: t.title,
          type: t.type,
          value: t.value,
          category: categoriesValues.find(
            category => category.title === t.category,
          ),
        };
      }),
    );

    await transactionRepository.save(transactionsCreate);

    fs.unlinkSync(uploadcsvFilePath);

    return transactionsCreate;
  }
}

export default ImportTransactionsService;
