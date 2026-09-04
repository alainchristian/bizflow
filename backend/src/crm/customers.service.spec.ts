import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomersService } from './customers.service.js';

describe('CustomersService', () => {
  let customersRepository: { findByIdInCurrentOrganization: ReturnType<typeof vi.fn> };
  let contactsRepository: { listForCustomer: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let customerNotesRepository: {
    listForCustomer: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let service: CustomersService;

  beforeEach(() => {
    customersRepository = { findByIdInCurrentOrganization: vi.fn() };
    contactsRepository = { listForCustomer: vi.fn(), create: vi.fn() };
    customerNotesRepository = { listForCustomer: vi.fn(), create: vi.fn() };

    service = new CustomersService(
      customersRepository as never,
      contactsRepository as never,
      customerNotesRepository as never,
    );
  });

  it('throws NotFoundException for a missing customer', async () => {
    customersRepository.findByIdInCurrentOrganization.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toThrow('Customer not found');
  });

  it('combines the customer with its contacts and notes', async () => {
    customersRepository.findByIdInCurrentOrganization.mockResolvedValue({
      id: 'customer-1',
      name: 'Acme Co',
    });
    contactsRepository.listForCustomer.mockResolvedValue([{ id: 'contact-1' }]);
    customerNotesRepository.listForCustomer.mockResolvedValue([{ id: 'note-1' }]);

    const detail = await service.findDetailById('customer-1');

    expect(detail).toMatchObject({
      id: 'customer-1',
      name: 'Acme Co',
      contacts: [{ id: 'contact-1' }],
      notes: [{ id: 'note-1' }],
    });
  });

  it('refuses to add a note to a nonexistent customer', async () => {
    customersRepository.findByIdInCurrentOrganization.mockResolvedValue(null);

    await expect(service.addNote('missing', 'user-1', 'hello')).rejects.toThrow(
      'Customer not found',
    );
    expect(customerNotesRepository.create).not.toHaveBeenCalled();
  });

  it('adds a note authored by the given user', async () => {
    customersRepository.findByIdInCurrentOrganization.mockResolvedValue({ id: 'customer-1' });
    customerNotesRepository.create.mockResolvedValue({ id: 'note-1', body: 'hello' });

    await service.addNote('customer-1', 'user-1', 'hello');

    expect(customerNotesRepository.create).toHaveBeenCalledWith({
      customerId: 'customer-1',
      authorUserId: 'user-1',
      body: 'hello',
    });
  });
});
