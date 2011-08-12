/*
 * Developed by : www.toepoke.co.uk
 *
 * If you redistribute this file, please keep this section in place.
 *
 * Version: 1.0.2
 * License: Same as jQuery - see http://jquery.org/license
*/

(function ($) {
	// tracks data for each instance of manyMail
	var _Sequence = 1;

	$.fn.manyMail = function (settings) {

		// default settings		
		settings = $.extend({
			separator: ";",
			title: "Submit your e-mail",
			modal: true,
			width: 570,
			height: 550,
			showHelp: true,
			showClient: true,
			showReset: true,
			validate: function(email) { 
				return defaultValidator(email); 
			},
			loadAddresses: function(email) {
				// By default we don't do anything
			},
			decode: function(emailAddress) {
				// no encoding by default, just return what we've been given
				return emailAddress;
			},
			confirmation: function (email) {
				// By default we don't display a confirmation 
				return true;
			},
			send: function(email) {
				// Caller must override the "send" method, so give a 
				// reminder if they haven't
				alert("override settings.send method to send the e-mail \n(you would be sending to [" + email.To + "])");

				return;
			}
		}, settings);
		

		this.each(function() {
			var alink = jQuery(this);
			var email = buildDefaultObject();
			email.settings = settings;
			email.startingEmail = email;
			
			getDataFromLink(email, alink);
			
			if (email.settings.loadAddresses) {
				// caller wants to add their own stuff in
				email.settings.loadAddresses(email);
				buildEmailLists(email);
			}

			var mailHtml = buildDialogHtml(email);

			// add html to the page so it can be called up later
			$("body").append(mailHtml);

			$(".mtp-button-delete").click(
				function () {
					$(this).parent().fadeOut();
				}
			);

			// wire up the onclick to open the dialog
			alink.click(
				function() { 
					// make sure we have the lists up-to-date
					buildEmailLists(email);
					wireUpDragNDrop(email);
					showDialog(email);					

					// prevent click through
					return false;
				}
			);

		});


		function showDialog(email) {
			var dlgButtons = {};
			if (email.settings.showHelp)		dlgButtons["Help"] = function() { showHelpDialog(); };
			if (email.settings.showClient)	dlgButtons["Outlook"] = function() { getDataFromDialog(email); openInClientApp(email); }
			if (email.settings.showReset)		dlgButtons["Reset"] = function() { resetDialog(email.startingEmail); }
			
			// Send is always present otherwise there's just no point
			dlgButtons["Send"] = function() {
				getDataFromDialog(email);
				var errMsg = email.settings.validate(email);
				if (errMsg && errMsg.length > 0) {
					// validation failed, so show error message and don't close the dialog
					showError(email, errMsg);
				} else {
					if (email.settings.confirmation(email)) {
						email.settings.send(email);	
						$( this ).dialog( "close" );
					}
				}
			}; // button send

			$("#" + email.ID).dialog( 
				{
					modal: email.settings.modal,
					width: email.settings.width,
					height: email.settings.height,
					title: email.settings.title,
					buttons: dlgButtons
				} // dialog settings
			) // dialog
		}; // showDialog


		function wireUpDragNDrop(email) {
			var prefix = "#" + email.ID;
			var sortableIDs = "#" + email.ToListID  + ", #" + email.CcListID + ", #" + email.BccListID;

			$(sortableIDs).sortable().disableSelection();
			// enable tabs
			var $tabs = $( "#" + email.TabsID ).tabs();

			var $tabItems = $("ul li", $tabs).droppable(
				{
					accept: ".connectedSortable li", 
					hoverClass: "ui-state-hover",
					drop: function( event, ui ) {
						var $item = $(this);
						var $list = $( $item.find("a").attr("href") )
							.find( ".connectedSortable" );

						// if we don't find a list, user must be adding item onto another item in the same list
						if ($list.length > 0) {
							ui.draggable.hide( "fast", 
								function() {
									$tabs.tabs("select", $tabItems.index( $item ));
									$(this).appendTo($list).show("fast");
								}
							);
						} // if

					} // drop event
				} // droppable settings
			);
		}; // wireUpDragNDrop


		function showHelpDialog() {
			// is the dialog already on the page?
			if ($("#mtp-dlg-help").length == 0) {
				// ... only do this once as it's the same content for all dialogs
				var helpHtml = buildHelpDialog();
				$("body").append(helpHtml);
			}

			$("#mtp-dlg-help").dialog(
				{
					modal: false,
					width: 450,
					height: 450,
					title: "Help",
					buttons: {
						Ok: function() { $(this).dialog("close"); }
					}
				}
			);

		}; // showHelpDialog
		
		
		function buildHelpDialog() {
			var html = "";

			html += '<div id="mtp-dlg-help" class="mtp-dlg ui-helper-hidden" title="manyMail help">';
			html += '<p>To send your e-mail, simply:</p>';
			html +=   '<ul>';
			html +=     '<li>Enter a relevant subject and message for your e-mail.</li>';
			html +=     '<li>Check all the people you want to send the e-mail to are in the <strong>To:</strong>, <strong>Cc:</strong> and/or <strong>Bcc:</strong> tabs.</li>';
			html +=     '<li>If you want someone in the <strong>To:</strong> tab recieve a blind-copy, simply drag \'n\' drop their address onto the <strong>Bcc:</strong> tab</li>';
			html +=     '<li>If you don\'t want someone to get the e-mail, simply click the little cross at the side of their address.</li>';
			html +=     '<li>If you make a mistake, simply click the <strong>Reset</strong> button to go back to where you started.</li>';
			html +=     '<li>When you\'re happy, click <strong>Send</strong>.</li>';
			html +=     '<li>If you prefer to use your installed e-mail applicatiion, click Outlook (you may not have Outlook, but you get the idea).</li>';
			html +=   '</ul>';
			html += '</div>';

			return html;
		}; // showHelpDialog


		function openInClientApp(email) {
			var href = "mailto:" + email.To + "?";
			
			if (email.Cc)
				href += "cc=" + email.Cc;
				
			if (email.Bcc) {
				if (!isLast(href, "?")) 
					// evidently there was a CC: component
					href += "&";
				href += "bcc=" + email.Bcc;
			}
			
			if (email.Subject) {
				if (!isLast(href, "?"))
					// evidently there was a CC: or BCC:
					href += "&";
				href += "subject=" + email.Subject;
			}
			
			if (email.Body) {
				if (!isLast(href, "?"))
					// evidently there was a CC:, BCC: or Subject
					href += "&";
				href += "body=" + email.Body;
			}
				
			// and fire a new window off so it opens in the client application
			var winMail = window.open(href, "_blank", "scrollbars=yes,resizable=yes,width=10,height=10");
			if (winMail)
				winMail.close();
				
		}; // openInClientApp
		
		function isLast(inputString, isChar) {
			if (inputString.length == 0)
				return false;
			if (inputString.charAt( inputString.length-1 ) == isChar)
				return true;
			else 
				return false;
				
		}; // isLast


		function resetDialog(email) {
			/// <summary>
			/// Resets the e-mail dialog back to the provided email object
			/// </summary>
			/// <param name="email">Email object to reset the form to</param>
			/// <returns>No return value</returns>
			
			$("#" + email.ID)
					.find("#" + email.SubjectID)
					.val( email.startingEmail.Subject )
				.end()
					.find("#" + email.BodyID)
					.val( email.startingEmail.Body )
				.end()
					.find("#" + email.ToListID)
					// note that jQuery "replaceWith" will remove "#mtp-to-list" as well, which we don't want
					.children()
					.remove()
					.end()
					.append( buildEmailButtonList(email.startingEmail.ToList) )
				.end()
					.find("#" + email.CcListID)
					// note thast jQuery "replaceWith" will remove "#mtp-cc-list" as well, which we don't want
					.children()
					.remove()
					.end()
					.append( buildEmailButtonList(email.startingEmail.CcList) )
				.end()
					.find("#" + email.BccListID)
					// note that jQuery "replaceWith" will remove "#mtp-bcc-list" as well, which we don't want
					.children()
					.remove()
					.end()
					.append( buildEmailButtonList(email.startingEmail.BccList) );
					
			// as we've replaced all the html in the To/Cc/Bcc tabs, we have to wire up 
			// the delete buttons again
			$(".mtp-button-delete", $("#" + email.TabsID) ).click(
				function () {
					$(this).parent().fadeOut();
				}
			);

			// again, as we've replaced the elements in the DOM, we need to wire up 
			// the drag 'n' drop stuff
			wireUpDragNDrop(email.startingEmail);

		}; // resetDialog


		function showError(email, errMsg) {
			/// <summary>
			/// Displays a dialog over the e-mail dialog telling the user stuff they need
			/// to fix before the e-mail can be sent.
			/// </summary>
			/// <param name="errMsg">Error message to display to the user, this is HTML, so I'd recommend <p><ul>...</p></param>
			/// <returns>Nothing</returns>

			var errDlg = $("#" + email.ErrDlgID);

			// has the error dialog already been created?
			if (errDlg.length == 0) {
				// hasn't been created yet, so add it into the DOM so we can report the error
				var html = "";
				html += '<div id="' + email.ErrDlgID + '" title="Error" class="ui-helper-hidden mtp-err-dlg">';
				html +=		'<div id="' + email.ErrMsgID + '">';
				html +=		errMsg;
				html +=		'</div>';
				html += '</div>';
				$("body").append(html);
				// read it back as we'll need it in a minute
				errDlg = $("#" + email.ErrDlgID);

			} else {
				// dialog already there, so just replace the content
				$("#" + email.ErrMsgID, errDlg).replaceWith(errMsg);
			}

			errDlg.dialog(
				{
					modal: true,
					buttons: {
						Ok: function() {
							$(this).dialog("close");
						}
					}
				}
			);

		}; // showError


		function defaultValidator(email) {
			/// <summary>
			/// Build-in validator to use for the e-mail dialog (i.e. used if the caller doesn't override it)
			/// Basically makes sure the user has entered the minumum expected data, ie. someone must be in the
			/// To: box, Subject and body must also have content
			/// </summary>
			/// <param name="email">Email object with the parsed data from the form</param>
			/// <returns>
			/// If the dialog is deemed valid, an empty string is returned to indicate everything is OK
			/// If the dialog is invalid and error message is returned as string
			/// </returns>

			if (email == null)
				// dunno what's happened there!
				throw "defaultValidator expected an email object";

			var errMsg = "";

			if (email.To == null || email.To == "")
				errMsg += "<li>You need at least a <strong>To:</strong> address.</li>";
			if (email.Subject == null || email.Subject == "")
				errMsg += "<li>You need to fill in the <strong>subject</strong> line.</li>";
			if (email.Body == null || email.Body == "")
				errMsg += "<li>You need to fill in the <strong>body</strong>.</li>";

			if (errMsg != "") {
				errMsg = 
					'<p>Sorry, but we couldn\'t send the e-mail:</p>' + 
					'<ul>' + errMsg + '</ul>';
				return errMsg;
			}

			return "";

		}; // defaultValidator


		function getDataFromDialog(email) {
			/// <summary>
			/// Gets the data from the form into a manageable object with the following properties:
			///		To      - to e-mail addresses separated by ";" (or settings.separator)
			///		Cc:     - copy e-mail addresses separated by ";" (or settings.separator)
			///		Bcc:    - blind copy e-mail addresses separated by ";" (or settings.separator)
			///		Subject - subject line in the dialog
			///		Body    - the body in the dialog
			/// </summary>
			/// <returns>Returns the object version of what's in the dialog</returns>

			email.Subject = $.trim( $("#" + email.SubjectID).val() );
			email.Body = $.trim( $("#" + email.BodyID).val() );

			email.To = "";   email.ToList = [];
			email.Cc = "";   email.CcList = [];
			email.Bcc = "";  email.BccList = [];

			// have to work around the fact that :visible (correctly) is dependent
			// on the parent being visible, which on an in-active tab it will be hidden, 
			// so we can't just do "#mtp-to-list li:visible", we have to do it the long way ...
			//$(this).parent().attr("id")
			$("#" + email.ToListID + " li, #" + email.CcListID + " li, #" + email.BccListID + " li").each(
				function (index) {
					var self = $(this);
					if (self.css("display") == "none")
						// item really is hidden, not just the parent, so skip this one
						return;

					var distId = self.parent().attr("id");
					var recipient = $.trim(self.text());
					var recipientSep = recipient + settings.separator;

					// I'm sure there's a better way of doing this ... but hay, it'll do :)
					if (distId === email.ToListID) 
						email.ToList.push( recipient );
					else if (distId === email.CcListID) 
						email.CcList.push( recipient );
					else 
						email.BccList.push( recipient );

				} // function
			); // each

				// and use the lists to create the separated versions
			email.To = email.ToList.join(email.settings.separator);
			email.Cc = email.CcList.join(email.settings.separator);
			email.Bcc = email.BccList.join(email.settings.separator);

			return email;
		}; // getDataFromDialog


		function buildDefaultObject() {
			var rootID = "mtp-" + _Sequence.toString();
			var emailObj = {
				ID: rootID,
				From: "",
				Reply: "",
				To: "",
				Cc: "",
				Bcc: "",
				Subject: "",
				Body: "",
				// make life a little easier
				ID: rootID,
				TabsID: rootID + "-tabs",
				ToListID: rootID + "-to-list",
				CcListID: rootID + "-cc-list",
				BccListID: rootID + "-bcc-list",
				FromID: rootID + "-from",
				ReplyID: rootID + "-reply",
				ToID: rootID + "-to",
				CcID: rootID + "-cc",
				BccID: rootID + "-bcc",
				SubjectID: rootID + "-subject",
				BodyID: rootID + "-body",
				ErrMsgID: rootID + "-err-msg",
				ErrDlgID: rootID + "-err-dlg"
			};

			// move the sequence on for the next one
			_Sequence++;

			return emailObj;

		}; // buildDefaultObject


		function getDataFromLink(email, alink) {
			/// <summary>
			/// Breaks down the href attribute in a "mailto" link into a more management object
			/// </summary>
			/// <param name="email">current email object to add link info to</param>
			/// <param name="alink">jQuery object pointing to a "mailto" "a" link</param>
			/// <returns>Returns the mailing object extracted from the mailto href</returns>
			if (alink == null)
				return;
			if (alink.attr("tagName").toUpperCase() != "A")
				return;
			if (alink.attr("href") == null)
				return;

			// OK, we've got an "a" tag, so try and get the data out
			var href = alink.attr("href");

			// as we're hacking a URL extraction function, fool it into thinking it's
			// a normal url by moving from "mailto:xyz@abc.com?subject=123" to "?to=xyz@abc.com&subject=123" 
			// so basically it's a consistent ?key=value&key=value format
			href = href.replace("?", "&").replace("mailto:", "?to=");

			var rootID = "mtp-" + _Sequence.toString();

			email.From = email.settings.decode( getParameterByName(href, "from") );
			email.Reply = email.settings.decode( getParameterByName(href, "reply") );
			email.To = email.settings.decode( getParameterByName(href, "to") );  
			email.Cc = email.settings.decode( getParameterByName(href, "cc") );
			email.Bcc = email.settings.decode( getParameterByName(href, "bcc") );
			email.Subject = getParameterByName(href, "subject");
			email.Body = getParameterByName(href, "body");
			
			// now we've got the To/Cc/Bcc bits (which CSV lists basically)
			// ... extract out the components bits into a list)			
			buildEmailLists(email);

			return email;
		};

		function buildEmailLists(email) {
			email.ToList  = splitEmail(email.To, email.settings.separator);
			email.CcList  = splitEmail(email.Cc, email.settings.separator);
			email.BccList = splitEmail(email.Bcc, email.settings.separator);

		}; // buildEmailLists

		function splitEmail(emailList, sep) {
			/// <summary>
			/// Splits the e-mail address into an array.  This is separated out as the "split" function will
			/// return an array with a length of 1, which will be an empty string?!?!!  So get in first
			/// and return an empty array if there's nothing to do.
			/// </summary>
			var arrEmails = emailList.split(sep);

			// We end up with an empty element at the end, so get
			// rid of those (usually because there's a single separator at the end of "emailList", or because
			// emailList is actually an empty string)
			while (arrEmails.length > 0 && arrEmails[arrEmails.length - 1] == "") {
				arrEmails.pop();
			}

			return arrEmails;
		}
				

		function buildDialogHtml( email ) {
			/// <summary>
			/// Draws the HTML for the e-mail dialog, pre-populating it with the "email" object that's been
			/// extracted from the "mailto" href.
			/// </summary>
			/// <param name="email">E-mail object to draw the dialog from</param>
			/// <returns>Returns the HTML for the jQuery UI dialog</returns>

			var html = "";

			html += '<div id="' + email.ID + '" class="mtp-dlg ui-helper-hidden" title="' + email.settings.title + '">';

			// header 
			html +=   '<ol class="mtp-header">';
			html +=     '<li>';
			html +=       '<label for="' + email.SubjectID + '" class="mtp-dlg-label">Subject:</label>';
			html +=       '<input type="text" id="' + email.SubjectID + '" class="ui-corner-all mtp-dlg-text" value="' + email.Subject + '" />';
			html +=     '</li>';
			html +=     '<li>';
			html +=       '<label for="' + email.BodyID + '" class="mtp-dlg-label">Message:</label>';
			html +=       '<textarea id="' + email.BodyID + '" class="ui-corner-all mtp-dlg-text mtp-dlg-body">' + email.Body + '</textarea>';
			html +=     '</li>';
			html +=   '</ol>';

			// tabs
			html +=   '<div id="' + email.TabsID + '" class="mtp-tabs">';
			html +=     '<ul>';
			html +=       '<li class="mtp-tab-item"><a href="#' + email.ToID + '">To:</a></li>';
			html +=       '<li class="mtp-tab-item"><a href="#' + email.CcID + '">Cc:</a></li>';
			html +=       '<li class="mtp-tab-item"><a href="#' + email.BccID + '">Bcc:</a></li>';
			html +=     '</ul>';
			html +=     '<div id="' + email.ToID + '">';
			html +=       '<ul id="' + email.ToListID + '" class="ui-helper-reset connectedSortable">';
			html += buildEmailButtonList(email.ToList);
			html +=       '</ul>';
			html +=     '</div>';
			html +=     '<div id="' + email.CcID + '">';
			html +=       '<ul id="' + email.CcListID + '" class="ui-helper-reset connectedSortable">';
			html += buildEmailButtonList(email.CcList);
			html +=       '</ul>';
			html +=     '</div>';
			html +=     '<div id="' + email.BccID + '">';
			html +=       '<ul id="' + email.BccListID + '" class="ui-helper-reset connectedSortable">';
			html += buildEmailButtonList(email.BccList);
			html +=       '</ul>';
			html +=     '</div>';
			html +=   '</div>';
			html += '</div>';			
				
			return html;
		};


		/// <summary>
		/// Helper method for drawing a list of e-mail buttons that appear in the To, Cc lists, etc.
		/// </summary>
		/// <param name="emailList">Array of email address to draw</param>
		/// <returns>Returns the HTML for the button list</returns>
		function buildEmailButtonList(emailList) {
			var html = "";
			for (var em in emailList) {
				html += buildEmailButton(emailList[em]);
			}
			return html;
		};


		function buildEmailButton(emailAddress) {
			/// <summary>
			/// Helper method for drawing one of the e-mail address buttons that appear in the To:, Cc: and Bcc: tabs.
			/// </summary>
			/// <param name="emailAddress">E-mail address to draw a button of</param>
			/// <returns>Returns the HTML for drawing an e-mail button</returns>

			var html =
				'<li class="ui-state-default ui-corner-all mtp-button">' + 
					emailAddress + 
					'<span class="ui-icon ui-icon-circle-close mtp-button-delete"></span>' +
				'</li>';

			return html;
		}


		// 
		function getParameterByName( href, name ) {
			/// <summary>
			/// Extracts a value for a given key in a querystring.
			/// </summary>
			/// <param name="href">href attribute to extract the value from</param>
			/// <param name="name">attribute name to extract from</param>
			/// <returns>Returns the value for the given URL parameter</returns>
			/// <remarks>
			/// Note that this is basically nabbed from the following question on stackoverflow.com
			/// http://stackoverflow.com/questions/901115/get-querystring-values-with-jquery
			/// </remarks>

			name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
			var regexS = "[\\?&]"+name+"=([^&#]*)";
			var regex = new RegExp( regexS );
			var results = regex.exec( href );
			// window.location.href
			if (results == null)
				return "";
			else
				return decodeURIComponent(results[1].replace(/\+/g, " "));
		};

	}; // manyMail


})(jQuery);
