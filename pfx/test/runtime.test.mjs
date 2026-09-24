import test from 'node:test';
import assert from 'node:assert/strict';
const {execute}=await import('../public/runtime.js');
test('same input gives same digest',async()=>{
  const x={cartridge:'demo',input:{message:' PFX READY '},steps:[{op:'normalize',field:'message'},{op:'sha256',field:'message'}]};
  assert.deepEqual(await execute(x),await execute(x));
});
