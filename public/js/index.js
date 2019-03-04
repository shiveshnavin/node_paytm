/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "/scripts/dist/";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	__webpack_require__(1);


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _creditCardType = __webpack_require__(2);

	var _creditCardType2 = _interopRequireDefault(_creditCardType);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	$(document).on('input change', '#input--cc input', function () {
	  var ccNum = $(this).val();
	  var ccType = (0, _creditCardType2.default)(ccNum);

	  if (!ccNum.length || typeof ccType === "undefined" || !ccType.length) {
	    $('#input--cc').removeClass().addClass('creditcard-icon');
	    return;
	  }

	  var creditcardType = ccType[0].type;

	  var ccTypes = {
	    'american-express': 'AE',
	    'master-card': 'MC',
	    'visa': 'VI',
	    'discover': 'DI'
	  };

	  $('#input--cc').removeClass().addClass('creditcard-icon').addClass('creditcard-icon--' + creditcardType); //set creditcard icon

	  // select creditcard type
	  $(".creditcard-type > select").val(ccTypes[creditcardType]);
	  // set the creditcard type <select> to the value entered
	});

/***/ },
/* 2 */
/***/ function(module, exports) {

	'use strict';

	var types = {};
	var VISA = 'visa';
	var MASTERCARD = 'master-card';
	var AMERICAN_EXPRESS = 'american-express';
	var DINERS_CLUB = 'diners-club';
	var DISCOVER = 'discover';
	var JCB = 'jcb';
	var UNIONPAY = 'unionpay';
	var MAESTRO = 'maestro';
	var CVV = 'CVV';
	var CID = 'CID';
	var CVC = 'CVC';
	var CVN = 'CVN';
	var testOrder = [
	  VISA,
	  MASTERCARD,
	  AMERICAN_EXPRESS,
	  DINERS_CLUB,
	  DISCOVER,
	  JCB,
	  UNIONPAY,
	  MAESTRO
	];

	function clone(x) {
	  var prefixPattern, exactPattern, dupe;

	  if (!x) { return null; }

	  prefixPattern = x.prefixPattern.source;
	  exactPattern = x.exactPattern.source;
	  dupe = JSON.parse(JSON.stringify(x));
	  dupe.prefixPattern = prefixPattern;
	  dupe.exactPattern = exactPattern;

	  return dupe;
	}

	types[VISA] = {
	  niceType: 'Visa',
	  type: VISA,
	  prefixPattern: /^4$/,
	  exactPattern: /^4\d*$/,
	  gaps: [4, 8, 12],
	  lengths: [16],
	  code: {
	    name: CVV,
	    size: 3
	  }
	};

	types[MASTERCARD] = {
	  niceType: 'MasterCard',
	  type: MASTERCARD,
	  prefixPattern: /^(5|5[1-5]|2|22|222|222[1-9]|2[3-6]|27[0-1]|2720)$/,
	  exactPattern: /^(5[1-5]|222[1-9]|2[3-6]|27[0-1]|2720)\d*$/,
	  gaps: [4, 8, 12],
	  lengths: [16],
	  code: {
	    name: CVC,
	    size: 3
	  }
	};

	types[AMERICAN_EXPRESS] = {
	  niceType: 'American Express',
	  type: AMERICAN_EXPRESS,
	  prefixPattern: /^(3|34|37)$/,
	  exactPattern: /^3[47]\d*$/,
	  isAmex: true,
	  gaps: [4, 10],
	  lengths: [15],
	  code: {
	    name: CID,
	    size: 4
	  }
	};

	types[DINERS_CLUB] = {
	  niceType: 'Diners Club',
	  type: DINERS_CLUB,
	  prefixPattern: /^(3|3[0689]|30[0-5])$/,
	  exactPattern: /^3(0[0-5]|[689])\d*$/,
	  gaps: [4, 10],
	  lengths: [14],
	  code: {
	    name: CVV,
	    size: 3
	  }
	};

	types[DISCOVER] = {
	  niceType: 'Discover',
	  type: DISCOVER,
	  prefixPattern: /^(6|60|601|6011|65|64|64[4-9])$/,
	  exactPattern: /^(6011|65|64[4-9])\d*$/,
	  gaps: [4, 8, 12],
	  lengths: [16, 19],
	  code: {
	    name: CID,
	    size: 3
	  }
	};

	types[JCB] = {
	  niceType: 'JCB',
	  type: JCB,
	  prefixPattern: /^(2|21|213|2131|1|18|180|1800|3|35)$/,
	  exactPattern: /^(2131|1800|35)\d*$/,
	  gaps: [4, 8, 12],
	  lengths: [16],
	  code: {
	    name: CVV,
	    size: 3
	  }
	};

	types[UNIONPAY] = {
	  niceType: 'UnionPay',
	  type: UNIONPAY,
	  prefixPattern: /^(6|62)$/,
	  exactPattern: /^62\d*$/,
	  gaps: [4, 8, 12],
	  lengths: [16, 17, 18, 19],
	  code: {
	    name: CVN,
	    size: 3
	  }
	};

	types[MAESTRO] = {
	  niceType: 'Maestro',
	  type: MAESTRO,
	  prefixPattern: /^(5|5[06-9]|6\d*)$/,
	  exactPattern: /^5[06-9]\d*$/,
	  gaps: [4, 8, 12],
	  lengths: [12, 13, 14, 15, 16, 17, 18, 19],
	  code: {
	    name: CVC,
	    size: 3
	  }
	};

	function creditCardType(cardNumber) {
	  var type, value, i;
	  var prefixResults = [];
	  var exactResults = [];

	  if (!(typeof cardNumber === 'string' || cardNumber instanceof String)) {
	    return [];
	  }

	  for (i = 0; i < testOrder.length; i++) {
	    type = testOrder[i];
	    value = types[type];

	    if (cardNumber.length === 0) {
	      prefixResults.push(clone(value));
	      continue;
	    }

	    if (value.exactPattern.test(cardNumber)) {
	      exactResults.push(clone(value));
	    } else if (value.prefixPattern.test(cardNumber)) {
	      prefixResults.push(clone(value));
	    }
	  }

	  return exactResults.length ? exactResults : prefixResults;
	}

	creditCardType.getTypeInfo = function (type) {
	  return clone(types[type]);
	};

	creditCardType.types = {
	  VISA: VISA,
	  MASTERCARD: MASTERCARD,
	  AMERICAN_EXPRESS: AMERICAN_EXPRESS,
	  DINERS_CLUB: DINERS_CLUB,
	  DISCOVER: DISCOVER,
	  JCB: JCB,
	  UNIONPAY: UNIONPAY,
	  MAESTRO: MAESTRO
	};

	module.exports = creditCardType;


/***/ }
/******/ ]);