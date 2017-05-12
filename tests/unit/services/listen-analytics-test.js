import { moduleFor, test } from 'ember-qunit';
import hifiNeeds from 'dummy/tests/helpers/hifi-needs';

moduleFor('service:listen-analytics', 'Unit | Service | listen analytics', {
  // Specify the other units that are required for this test.
  needs: [...hifiNeeds]
});

// Replace this with your real tests.
test('it exists', function(assert) {
  let service = this.subject();
  assert.ok(service);
});
