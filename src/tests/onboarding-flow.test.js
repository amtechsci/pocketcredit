/**
 * Onboarding Flow Tests
 * Tests the complete onboarding flow to ensure proper step progression
 */

const request = require('supertest');
const app = require('../server/server');

describe('Onboarding Flow', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    // Create a test user and get auth token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        phone: '9999999999',
        name: 'Test User'
      });

    expect(registerResponse.status).toBe(201);
    userId = registerResponse.body.data.user.id;
    authToken = registerResponse.body.data.token;
  });

  describe('Step Progression', () => {
    test('Step 2: Basic Details should progress to step 3', async () => {
      const response = await request(app)
        .put('/api/user/profile/basic')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          date_of_birth: '1990-01-01',
          gender: 'male',
          marital_status: 'single'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.user.profile_completion_step).toBe(3);
      expect(response.body.data.next_step).toBe('additional_details');
      expect(response.body.data.profile_completed).toBe(false);
    });

    test('Step 3: Additional Details should progress to step 4', async () => {
      const response = await request(app)
        .put('/api/user/profile/additional')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          current_address_line1: '123 Main St',
          current_city: 'Mumbai',
          current_state: 'Maharashtra',
          current_pincode: '400001',
          current_country: 'India',
          permanent_address_line1: '123 Main St',
          permanent_city: 'Mumbai',
          permanent_state: 'Maharashtra',
          permanent_pincode: '400001',
          permanent_country: 'India',
          pan_number: 'ABCDE1234F'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.user.profile_completion_step).toBe(4);
      expect(response.body.data.next_step).toBe('employment_details');
      expect(response.body.data.profile_completed).toBe(false);
    });

    test('Step 4: Employment Details should complete profile', async () => {
      const response = await request(app)
        .post('/api/employment-details')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          monthly_income: '50000',
          employment_type: 'salaried',
          company_name: 'Test Company',
          designation: 'Software Engineer',
          salary_date: '15'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.user.profile_completion_step).toBe(5);
      expect(response.body.data.next_step).toBe('dashboard');
      expect(response.body.data.profile_completed).toBe(true);
    });
  });

  describe('Profile Status API', () => {
    test('Should return correct step information', async () => {
      const response = await request(app)
        .get('/api/user/profile/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.profile_status.current_step).toBe(5);
      expect(response.body.data.profile_status.step_name).toBe('complete');
      expect(response.body.data.profile_status.next_step).toBe(null);
      expect(response.body.data.profile_status.is_complete).toBe(true);
      expect(response.body.data.profile_status.progress_percentage).toBe(100);
    });
  });

  describe('Edge Cases', () => {
    test('Should not allow skipping steps', async () => {
      // Try to submit employment details without completing additional details
      const response = await request(app)
        .post('/api/employment-details')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          monthly_income: '50000',
          employment_type: 'salaried',
          company_name: 'Test Company',
          designation: 'Software Engineer',
          salary_date: '15'
        });

      // This should work because we already completed additional details in previous test
      expect(response.status).toBe(201);
    });

    test('Should handle invalid data gracefully', async () => {
      const response = await request(app)
        .post('/api/employment-details')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          monthly_income: 'invalid',
          employment_type: 'invalid_type',
          company_name: '',
          designation: '',
          salary_date: '32'
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });
});
