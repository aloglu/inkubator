function ChangeUrl(title, url, loadingPage)
{
	if (typeof (history.pushState) != "undefined") {
		var obj = { Title: title, Url: url };
		history.pushState(obj, obj.Title, obj.Url);
	} else {
		var redirectURL = loadingPage + url;
		window.location.assign(redirectURL);
	}
}

function fetchRowCount()
{
	var xmlhttp;
	xmlhttp=new XMLHttpRequest();
	xmlhttp.onreadystatechange=function()
	{
		if (xmlhttp.readyState==4 && xmlhttp.status==200)
		{
			document.getElementById("numInkCount").innerHTML = xmlhttp.responseText;
		}
	}
	xmlhttp.open("GET", "getRowCount.php", true);
	xmlhttp.send();
}
function fetchColors()
{
	var xmlhttp;
	xmlhttp=new XMLHttpRequest();
	xmlhttp.onreadystatechange=function()
	{
		if (xmlhttp.readyState==4 && xmlhttp.status==200)
		{
			document.getElementById("fpink_box").innerHTML = xmlhttp.responseText;
		}
	}
	xmlhttp.open("GET", "getColors.php", true);
	xmlhttp.send();
}

function fetchBrands()
{
	var xmlhttp;
	xmlhttp=new XMLHttpRequest();
	xmlhttp.onreadystatechange=function()
	{
		if (xmlhttp.readyState==4 && xmlhttp.status==200)
		{
			document.getElementById("fpink_box").innerHTML = xmlhttp.responseText;
		}
	}
	xmlhttp.open("GET", "getBrands.php", true);
	xmlhttp.send();
}

function fetchBrandsDropdown()
{
	var xmlhttp;
	xmlhttp=new XMLHttpRequest();
	xmlhttp.onreadystatechange=function()
	{
		if (xmlhttp.readyState==4 && xmlhttp.status==200)
		{
			document.getElementById("brandDropdown").innerHTML = xmlhttp.responseText;
		}
	}
	xmlhttp.open("GET", "getBrandsDropdown.php", true);
	xmlhttp.send();
}

function fetchInksDropdown()
{
	var brandChoice = document.getElementById("brandDropdownSelector").value;
	var xmlhttp;
	xmlhttp=new XMLHttpRequest();
	xmlhttp.onreadystatechange=function()
	{
		if (xmlhttp.readyState==4 && xmlhttp.status==200)
		{
			document.getElementById("inkDropdown").innerHTML = xmlhttp.responseText;
		}
	}
	xmlhttp.open("GET", "getInksDropdown.php?brandChoice=" + brandChoice, true);
	xmlhttp.send();
}

function loadSwatchesByColor(colorName)
{
	document.getElementById("fpink_display").innerHTML = "<h3>Loading " + colorName + " Swatches...</h3><div class=\"loader\"></div>";
	var xmlhttp;
	xmlhttp=new XMLHttpRequest();
	xmlhttp.onreadystatechange=function()
	{
		if (xmlhttp.readyState==4 && xmlhttp.status==200)
		{
			document.getElementById("fpink_display").innerHTML = xmlhttp.responseText;
			var title = "InkSwatch.com - Results in " + colorName + " color group";
			var nvpairs = "?color=" + colorName;
			var loadingPage = "color.html";
			ChangeUrl(title,nvpairs,loadingPage);
		}
	}
	xmlhttp.open("GET", "getColorSwatches.php?colorChoice=" + colorName, true);
	xmlhttp.send();
}

function loadSwatchesByBrand(brandNameURL,brandName)
{
	var brandNameDecoded = "";
	if (brandName == '')
	{
		brandNameDecoded = decodeURIComponent (brandNameURL);
	}
	else
	{
		brandNameDecoded = brandName;
	}
	
	document.getElementById("fpink_display").innerHTML = "<h3>Loading " + brandNameDecoded + " Swatches...</h3><div class=\"loader\"></div>";
	var xmlhttp;
	xmlhttp=new XMLHttpRequest();
	xmlhttp.onreadystatechange=function()
	{
		if (xmlhttp.readyState==4 && xmlhttp.status==200)
		{
			document.getElementById("fpink_display").innerHTML = xmlhttp.responseText;
			var title = "InkSwatch.com - Results for " + brandNameDecoded;
			var nvpairs = "?brand=" + brandNameDecoded;
			var loadingPage = "brand.html";
			ChangeUrl(title,nvpairs,loadingPage);
		}
	}
	xmlhttp.open("GET", "getBrandSwatches.php?brandChoice=" + brandNameURL, true);
	xmlhttp.send();
}

function loadSwatchesByColorChoice(method)
{	
	if (method == "picker")
	{
		var hexCodeFromHSL = HSL_to_RGB(hslider.value,sslider.value,lslider.value);
		document.getElementById("hexCodeInput").value = hexCodeFromHSL;
	}
	
	var hexColorChoice = document.getElementById("hexCodeInput").value;
	
	if (hexColorChoice.length == 6)
	{
		var regexp = /^[0-9a-fA-F0-9]+$/;
		
		if (regexp.test(hexColorChoice))
		{
			document.getElementById("invalidHexWarning").style.display = "none";
			document.getElementById("fpink_display").innerHTML = "<h3>Loading Swatches...</h3><div class=\"loader\"></div>";
			var xmlhttp;
			xmlhttp=new XMLHttpRequest();
			xmlhttp.onreadystatechange=function()
			{
				if (xmlhttp.readyState==4 && xmlhttp.status==200)
				{
					document.getElementById("fpink_display").innerHTML = xmlhttp.responseText;
					var title = "InkSwatch.com - Results for " + hexColorChoice;
					var nvpairs = "?hexColorChoice=" + hexColorChoice;
					var loadingPage = "choice.html";
					ChangeUrl(title,nvpairs,loadingPage);
					
					document.getElementById("fpink_display").scrollIntoView();
				}
			}
			xmlhttp.open("GET", "getColorChoiceSwatches.php?userColorChoice=" + hexColorChoice, true);
			xmlhttp.send();
		}
        else
		{
			document.getElementById("invalidHexWarning").style.display = "block";
		}
	}

	else
	{
		document.getElementById("invalidHexWarning").style.display = "block";
	}
}

function loadSwatchesByInk(inkId)
{
	document.getElementById("fpink_display").innerHTML = "<h3>Loading Swatches...</h3><div class=\"loader\"></div>";
	var xmlhttp;
	xmlhttp=new XMLHttpRequest();
	xmlhttp.onreadystatechange=function()
	{
		if (xmlhttp.readyState==4 && xmlhttp.status==200)
		{
			document.getElementById("fpink_display").innerHTML = xmlhttp.responseText;
			var title = "InkSwatch.com - Search by specific ink";
			var nvpairs = "?inkId=" + inkId;
			var loadingPage = "ink.html";
			ChangeUrl(title,nvpairs,loadingPage);
			
			var divID = "ink" + inkId;
			document.getElementById(divID).scrollIntoView();
		}
	}
	xmlhttp.open("GET", "getInkChoiceSwatches.php?inkId=" + inkId, true);
	xmlhttp.send();
}

function loadSwatchesByMostRecent()
{
	var xmlhttp;
	xmlhttp=new XMLHttpRequest();
	xmlhttp.onreadystatechange=function()
	{
		if (xmlhttp.readyState==4 && xmlhttp.status==200)
		{
			document.getElementById("fpink_display").innerHTML = xmlhttp.responseText;
		}
	}
	xmlhttp.open("GET", "getRecentSwatches.php", true);
	xmlhttp.send();
}

function loadSwatchesByMostViewedWeekly()
{
	var xmlhttp;
	xmlhttp=new XMLHttpRequest();
	xmlhttp.onreadystatechange=function()
	{
		if (xmlhttp.readyState==4 && xmlhttp.status==200)
		{
			document.getElementById("fpink_display_weekly").innerHTML = xmlhttp.responseText;
		}
	}
	xmlhttp.open("GET", "getMostViewedInksWeekly.php", true);
	xmlhttp.send();
}

function loadSwatchesByMostViewedAllTime()
{
	var xmlhttp;
	xmlhttp=new XMLHttpRequest();
	xmlhttp.onreadystatechange=function()
	{
		if (xmlhttp.readyState==4 && xmlhttp.status==200)
		{
			document.getElementById("fpink_display_alltime").innerHTML = xmlhttp.responseText;
		}
	}
	xmlhttp.open("GET", "getMostViewedInksAllTime.php", true);
	xmlhttp.send();
}

function loadFromUrl(page)
{
	var urlQuery = window.location.search;
	
	if(urlQuery != 'undefined' && urlQuery !="")
	{
		urlQuery = urlQuery.split("?");
		urlQuery = urlQuery[1];
		
		if (page == "color")
		{
			var color = urlQuery.split("color=");
				color = color[1];
			if (color){
				loadSwatchesByColor(color);
			}
		}
		
		if (page == "brand")
		{
			var brand = urlQuery.split("brand=");
				brand = brand[1];
			if (brand){
				loadSwatchesByBrand(brand,'');
			}
		}
		
		if (page == "ink")
		{
			var ink = urlQuery.split("inkId=");
				ink = ink[1];
			if (ink){
				loadSwatchesByInk(ink);
			}
		}
		
		if (page == "choice")
		{
			var choice = urlQuery.split("hexColorChoice=");
				choice = choice[1];
			if (choice){
				document.getElementById("hexCodeInput").value = choice;
				loadSwatchesByColorChoice('');
				updateSlidersFromHex(choice);
			}
		}
	}

}

function showModal(inkid)
{
	var headeridname = inkid + "Header";
	var swatchidname = inkid + "Swatch";
	var wridname = inkid + "WR";
	var shimmeridname = inkid + "Shimmer";
	var irongallidname = inkid + "Irongall";
	var reviewidname = inkid + "Review";
	var hexidname = inkid + "HexCode";
	var HSLidname = inkid + "HSL";
	var HSVidname = inkid + "HSV";
		
	var header = document.getElementById(headeridname);
	var swatch = document.getElementById(swatchidname);
	var wr = document.getElementById(wridname);
	var shimmer = document.getElementById(shimmeridname);
	var irongall = document.getElementById(irongallidname);
	var review = document.getElementById(reviewidname);
	var hexCode = document.getElementById(hexidname);
	var HSL = document.getElementById(HSLidname);
	var HSV = document.getElementById(HSVidname);
	
	var dbid = inkid.split("ink");
	dbid = dbid[1];
	
	document.getElementById("modalHeader").innerHTML = '<a href="ink.html?inkId=' + dbid + '">' + header.innerHTML + '</a>';
	document.getElementById("modalSwatch").src = swatch.src;
	document.getElementById("modalSwatch").alt = swatch.alt;
	document.getElementById("modalSwatch").title = swatch.title;
	document.getElementById("modalWR").src = wr.src;
	document.getElementById("modalWR").alt = wr.alt;
	document.getElementById("modalWR").title = wr.title;
	document.getElementById("modalHexCode").innerHTML = hexCode.innerHTML;
	document.getElementById("modalHSL").innerHTML = HSL.innerHTML;
	document.getElementById("modalHSV").innerHTML = HSV.innerHTML;
	document.getElementById("modalShimmer").innerHTML = shimmer.innerHTML;
	document.getElementById("modalIrongall").innerHTML = irongall.innerHTML;
	document.getElementById("modalReview").innerHTML = review.innerHTML;
	document.getElementById("myModal").style.display = "block";
}

function hideModal()
{
	document.getElementById("myModal").style.display = "none";
}

function showColorPickerModal()
{
	document.getElementById("colorPickerModal").style.display = "block";
}

function hideColorPickerModal()
{
	document.getElementById("colorPickerModal").style.display = "none";
	loadSwatchesByColorChoice('picker');
}

function hideSearchModal()
{
	document.getElementById("searchTextBox").value = "";
	document.getElementById("searchResults").innerHTML = "";
	document.getElementById("searchModal").style.display = "none";
}

function showSearchModal()
{
	document.getElementById("searchModal").style.display = "block";
	document.getElementById("searchTextBox").focus();
}

function closeOnClickOutside(event)
{
	var modal = document.getElementById("myModal");
	var colorPickerModal = document.getElementById("colorPickerModal");
	var searchModal = document.getElementById("searchModal");
	
	if (event.target == modal)
	{
		hideModal();
	}
	
	if (event.target == colorPickerModal)
	{
		hideColorPickerModal();
	}
	
	if (event.target == searchModal)
	{
		hideSearchModal();
	}
}

function getSearchResults()
{
	var query = document.getElementById("searchTextBox").value;
	
	if (query == "")
	{
		document.getElementById("searchResults").innerHTML = "";
	}
	
	else{
		var xmlhttp;
		xmlhttp=new XMLHttpRequest();
		xmlhttp.onreadystatechange=function()
		{
			if (xmlhttp.readyState==4 && xmlhttp.status==200)
			{
				document.getElementById("searchResults").innerHTML = xmlhttp.responseText;
			}
		}
		xmlhttp.open("GET", "getSearchResults.php?query=" + query, true);
		xmlhttp.send();
	}
}

var global_timeout;

function sendQuery()
{
	var loading_div = "<h3>Searching...</h3><div class=\"loader\"></div>";
	
	var current_results_content = document.getElementById("searchResults").innerHTML;
	
	if (current_results_content != loading_div)
	{
		document.getElementById("searchResults").innerHTML = loading_div;
	}
	
	if (global_timeout)
	{
		clearTimeout(global_timeout);
	}
	
	global_timeout = setTimeout(getSearchResults, 250);
}

function applyFilters()
{
	var callingPage = document.getElementById("filterCallingPage").value;
	var currentInfo = document.getElementById("filterCurrentInfo").value;
	var color = "";
	var brand = "";
	
	if(callingPage == "brand")
	{
		color = document.getElementById("colorFilterDropdownSelector").value;
	}
	else
	{
		brand = document.getElementById("brandFilterDropdownSelector").value;
	}
	
	var standard = document.getElementById("StandardCheckbox").checked;
	var shimmer = document.getElementById("ShimmerCheckbox").checked;
	var ironGall = document.getElementById("IronGallCheckbox").checked;
	
	var params = "";
	
	params = "standard=" + standard;
	params += "&shimmer=" + shimmer;
	params += "&ironGall=" + ironGall;
	if(callingPage == "brand")
	{
		params += "&color=" + color;
	}
	else
	{
		params += "&brand=" + brand;
	}
	params += "&callingPage=" + callingPage;
	params += "&currentInfo=" + currentInfo;
	
	document.getElementById("fpink_display").innerHTML = "<h3>Loading Swatches...</h3><div class=\"loader\"></div>";
	var xmlhttp;
	xmlhttp=new XMLHttpRequest();
	xmlhttp.onreadystatechange=function()
	{
		if (xmlhttp.readyState==4 && xmlhttp.status==200)
		{
			document.getElementById("fpink_display").innerHTML = xmlhttp.responseText;
		}
	}
	xmlhttp.open("GET", "applyFilters.php?" + params, true);
	xmlhttp.send();
}