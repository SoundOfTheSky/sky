function test(fn: () => boolean) {
  console.log(fn.toString());
}
test(() => Date.now() === 2 && Math.random() !== 5);
