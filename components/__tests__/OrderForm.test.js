import React from 'react';
import { mount } from 'enzyme';
import sinon from 'sinon';

import { withRequiredProviders } from '../../test/providers';

import OrderForm from '../OrderForm';
import * as stripe from '../../lib/stripe';
import * as api from '../../lib/api';

const getStripeToken = sinon.stub(stripe, 'getStripeToken').callsFake(() => {
  return {
    token: 'xxx',
    card: {
      country: 'US',
      brand: 'VISA',
      funding: 'credit',
    },
  };
});

sinon.stub(api, 'checkUserExistence').callsFake(() => Promise.resolve(false));

describe('OrderForm component', () => {
  const tiers = {
    donor: {
      name: 'donor',
      slug: 'donors',
      presets: [1000, 5000, 25000],
      currency: 'USD',
      button: 'donate',
    },
    backer: {
      name: 'backer',
      amount: 1000,
      interval: 'month',
    },
  };
  const collective = {
    host: {
      name: 'host name',
      slug: 'host',
    },
  };
  const order = {
    totalAmount: 1000,
    interval: 'month',
    tier: tiers.donor,
  };

  const expectValue = (component, className, value) => {
    expect(component.find(`.${className} .value`).text()).toEqual(value);
  };

  const fillValue = (component, field, value) => {
    const c = component.find({ name: field }).hostNodes();
    c.simulate('change', { target: { value } });
  };

  const mountComponent = (props, queryStub) =>
    mount(
      withRequiredProviders(<OrderForm {...props} />, {
        ApolloProvider: { client: { query: queryStub || Promise.resolve } },
      }),
    );

  let component;

  afterEach(() => {
    if (component) {
      component.unmount();
    }
  });

  describe('error messages', () => {
    it('error.email.invalid', done => {
      component = mountComponent({ collective, order });
      fillValue(component, 'email', 'testuser');
      setTimeout(() => {
        component.find('.submit button').simulate('click');
        const errorNode = component.find('.result .error').hostNodes();
        expect(errorNode.text()).toEqual('Invalid email address');
        done();
      }, 500);
    });
  });

  describe('not logged in', () => {
    // Doesn't work anymore because of Stripe Element
    it.skip('show the user details form and credit card form', done => {
      const onSubmit = order => {
        expect(getStripeToken.callCount).toEqual(1);
        expect(order.user).toEqual({ ...LoggedInUser });
        expect(order.totalAmount).toEqual(tiers.donor.presets[2]);
        done();
      };

      const LoggedInUser = {
        email: 'xavier@opencollective.com',
        firstName: 'Xavier',
        lastName: 'Damman',
        twitterHandle: 'xdamman',
        description: 'entrepreneur',
      };

      component = mountComponent({ collective, order, onSubmit });

      expect(component.find('input[type="email"]').exists()).toBeTrue;
      for (const prop in LoggedInUser) {
        fillValue(component, prop, LoggedInUser[prop]);
      }
      fillValue(component, 'publicMessage', 'public message');

      component
        .find('.presetBtn')
        .last()
        .simulate('click');
      setTimeout(() => {
        component.find('.submit button').simulate('click');
      }, 2000);
    });
  });

  describe('logged in', () => {
    // @TODO: update this test for new OrderForm
    it.skip('let the user pick a credit card', done => {
      getStripeToken.reset();

      const LoggedInUser = {
        id: 1,
        email: 'xavier@opencollective.com',
        firstName: 'Xavier',
        lastName: 'Damman',
        twitterHandle: 'xdamman',
        description: 'entrepreneur',
        memberOf: [
          {
            role: 'ADMIN',
            collective: {
              id: 7,
              name: 'Tipbox',
            },
          },
        ],
        collective: {
          name: 'Xavier Damman',
          paymentMethods: [
            {
              uuid: '8cbb6e96-aee5-482e-a027-cf242e12a139',
              identifier: '4242',
              data: {
                brand: 'visa',
                expMonth: 12,
                expYear: 2022,
              },
            },
          ],
        },
      };

      const onSubmit = order => {
        expect(getStripeToken.callCount).toEqual(0);
        expect(order.user).toEqual({
          id: LoggedInUser.id,
          paymentMethod: {
            save: true,
            uuid: LoggedInUser.paymentMethods[0].uuid,
          },
        });
        expect(order.publicMessage).toEqual('public message');
        expect(order.totalAmount).toEqual(order.totalAmount);
        done();
      };

      component = mountComponent({ collective, order, onSubmit, LoggedInUser });
      component.setProps({ LoggedInUser });

      expect(component.find('input[type="email"]').exists()).toBeFalse;
      fillValue(component, 'publicMessage', 'public message');

      for (const prop in LoggedInUser) {
        if (prop !== 'paymentMethods' && prop !== 'id') {
          expectValue(component, prop, LoggedInUser[prop]);
        }
      }
      expect(component.find('.creditcardSelector').exists()).toBeTrue;
      expect(component.find('.creditcardSelector').html()).toContain(LoggedInUser.paymentMethods[0].identifier);
      setTimeout(() => {
        component.find('.submit button').simulate('click');
        setTimeout(() => {
          console.log('>>> result: ', component.find('.result').html());
        }, 500);
      }, 2000);
    });
  });
});
