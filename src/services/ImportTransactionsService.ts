import { getCustomRepository, getRepository } from 'typeorm';
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

    const transactionsCSV: {
      title: string;
      type: 'income' | 'outcome';
      value: number;
      category: string;
    }[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line;
      transactionsCSV.push({ title, type, value, category });
    });
    await new Promise(resolve => parseCSV.on('end', resolve));

    const categoryRepository = getRepository(Category);

    const transactions = await Promise.all(
      transactionsCSV.map(async t => {
        let categoryObject = await categoryRepository.findOne({
          where: { title: t.category },
        });

        if (!categoryObject) {
          categoryObject = categoryRepository.create({
            title: t.category,
          });

          await categoryRepository.save(categoryObject);
        }
        return {
          title: t.title,
          type: t.type,
          value: t.value,
          category: categoryObject,
        };
      }),
    );

    const transactionsCreate = transactionRepository.create(
      transactions.map(t => ({
        title: t.title,
        type: t.type,
        value: t.value,
        category: t.category,
      })),
    );

    await transactionRepository.save(transactionsCreate);

    fs.unlinkSync(uploadcsvFilePath);

    return transactionsCreate;
  }
}

export default ImportTransactionsService;
