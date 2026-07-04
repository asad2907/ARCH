(function () {
  var navigation = performance.getEntriesByType('navigation')[0];
  var isReload = navigation
    ? navigation.type === 'reload'
    : performance.navigation && performance.navigation.type === 1;
  var isFirstVisit = true;

  try {
    isFirstVisit = sessionStorage.getItem('tabeen-visited') !== 'true';
    sessionStorage.setItem('tabeen-visited', 'true');
  } catch (error) {
    // If storage is unavailable, retain the safe first-visit loader behavior.
  }

  document.documentElement.classList.add(
    isFirstVisit || isReload ? 'show-loader' : 'seamless-entry'
  );
}());
