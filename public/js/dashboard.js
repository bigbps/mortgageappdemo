window.onload = function() {
  addResizeListeners();
  setSidenavListeners();
  setMenuClickListener();
  setSidenavCloseListener();

  let purchasingRate;
  let refinanceRate;

  $('#purchaseRateId').mask('00.00%', {reverse: true});
  $('#refinanceRate').mask('00.00%', {reverse: true});

  $.ajax({
    url: 'https://us-central1-fir-app-141ad.cloudfunctions.net/getRates',
    dataType: "json",
    method: 'POST',
    crossDomain: true,
    success: function(data) {
      purchasingRate = data.data.purchase;
      refinanceRate = data.data.refinance;
      document.getElementById("pr").innerHTML = purchasingRate;
      document.getElementById("rr").innerHTML = refinanceRate;
      $('#purchaseRateId').val(purchasingRate);
      $('#refinanceRate').val(refinanceRate);
    },
    error: function() {
      console.log('Could not get rates!');
    }
  });

  $.ajax({
    url: 'https://us-central1-fir-app-141ad.cloudfunctions.net/getAllPartners',
    dataType: "json",
    method: 'POST',
    crossDomain: true,
    success: function(data) {
      document.getElementById("tp").innerHTML = Object.keys(data.data).length;
      $.each(data.data,function(key, val){
        let tableData = "<tr><td>" + val.firstName + " " + val.lastName + "</td><td>" + val.flag + "</td><td>" + val.company + "</td><td>" + val.mobile + "</td><td>" + val.status + "</td><td>" + val.points + "<i class='fas fa-pencil-alt ml-2'></i></td></tr>";
        $('#dataTable').append(tableData);
      });
    
    },
    error: function() {
      console.log('Could not get partners!');
    }
  });

  $.ajax({
    url: 'https://us-central1-fir-app-141ad.cloudfunctions.net/getAllDeals',
    dataType: "json",
    method: 'POST',
    crossDomain: true,
    success: function(data) {
      document.getElementById("td").innerHTML = Object.keys(data.data).length;
      $.each(data.data,function(key, val){
        let dealsData = "<tr><td>" + val.primaryApplicantFirstName + " " + val.primaryApplicantLastName + "</td><td>" + val.primaryApplicantEmail + "</td><td>" + val.primaryApplicantMobile + "</td><td>" + val.agentCode + "</td><td>" + 'In Progress' + "</td></tr>";
        $('#dealsTable').append(dealsData);
      });
    },
    error: function() {
      console.log('Could not get deals!');
    }
  });

  $('#editPurchase, #editRefi').on('click', function(e) {
    console.log('Clicked');
    if (e.target.id === "editRefi") {
      document.getElementById("rr").innerHTML = $('#refinanceRate').val();
      data = {
        rate: $('#refinanceRate').val(),
        type: e.target.id
      }
    } else {
      document.getElementById("pr").innerHTML = $('#purchaseRateId').val();
      data = {
        rate: $('#purchaseRateId').val(),
        type: e.target.id
      }
    }
    $.ajax({
      url: 'https://us-central1-fir-app-141ad.cloudfunctions.net/editRates',
      dataType: "json",
      method: 'POST',
      crossDomain: true,
      data: data,
      success: function() {
        console.log('Rate successfully changed')
      },
      error: function() {
        console.log('Could not set rate!');
      }
    });
  });
}

// Set constants and grab needed elements
const gridEl = $('.grid');
const SIDENAV_ACTIVE_CLASS = 'sidenav--active';
const GRID_NO_SCROLL_CLASS = 'grid--noscroll';

function toggleClass(el, className) {
  if (el.hasClass(className)) {
    el.removeClass(className);
  } else {
    el.addClass(className);
  }
}

// Sidenav list sliding functionality
function setSidenavListeners() {
  const subHeadings = $('.navList__subheading'); console.log('subHeadings: ', subHeadings);
  const SUBHEADING_OPEN_CLASS = 'navList__subheading--open';
  const SUBLIST_HIDDEN_CLASS = 'subList--hidden';

  subHeadings.each((i, subHeadingEl) => {
    $(subHeadingEl).on('click', (e) => {
      const subListEl = $(subHeadingEl).siblings();

      // Add/remove selected styles to list category heading
      if (subHeadingEl) {
        toggleClass($(subHeadingEl), SUBHEADING_OPEN_CLASS);
      }

      // Reveal/hide the sublist
      if (subListEl && subListEl.length === 1) {
        toggleClass($(subListEl), SUBLIST_HIDDEN_CLASS);
      }
    });
  });
}

function toggleClass(el, className) {
  if (el.hasClass(className)) {
    el.removeClass(className);
  } else {
    el.addClass(className);
  }
}

// If user opens the menu and then expands the viewport from mobile size without closing the menu,
// make sure scrolling is enabled again and that sidenav active class is removed
function addResizeListeners() {
  $(window).resize(function(e) {
    const width = window.innerWidth; console.log('width: ', width);

    if (width > 750) {
      sidenavEl.removeClass(SIDENAV_ACTIVE_CLASS);
      gridEl.removeClass(GRID_NO_SCROLL_CLASS);
    }
  });
}

// Menu open sidenav icon, shown only on mobile
function setMenuClickListener() {
  $('.header__menu').on('click', function(e) { console.log('clicked menu icon');
    toggleClass(sidenavEl, SIDENAV_ACTIVE_CLASS);
    toggleClass(gridEl, GRID_NO_SCROLL_CLASS);
  });
}

// Sidenav close icon
function setSidenavCloseListener() {
  $('.sidenav__brand-close').on('click', function(e) {
    toggleClass(sidenavEl, SIDENAV_ACTIVE_CLASS);
    toggleClass(gridEl, GRID_NO_SCROLL_CLASS);
  });
}
