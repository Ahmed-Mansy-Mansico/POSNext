// Print utility for POS invoices
export function printInvoice(invoiceData) {
	const printWindow = window.open('', '_blank', 'width=800,height=600')

	const printContent = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="UTF-8">
			<title>Invoice - ${invoiceData.name}</title>
			<style>
				* {
					margin: 0;
					padding: 0;
					box-sizing: border-box;
				}

				body {
					font-family: 'Courier New', monospace;
					padding: 20px;
					width: 80mm;
					margin: 0 auto;
				}

				.receipt {
					width: 100%;
				}

				.header {
					text-align: center;
					margin-bottom: 20px;
					border-bottom: 2px dashed #000;
					padding-bottom: 10px;
				}

				.company-name {
					font-size: 18px;
					font-weight: bold;
					margin-bottom: 5px;
				}

				.invoice-info {
					margin-bottom: 15px;
					font-size: 12px;
				}

				.invoice-info div {
					display: flex;
					justify-content: space-between;
					margin-bottom: 3px;
				}

				.items-table {
					width: 100%;
					margin-bottom: 15px;
					border-top: 1px dashed #000;
					border-bottom: 1px dashed #000;
					padding: 10px 0;
				}

				.item-row {
					display: flex;
					justify-content: space-between;
					margin-bottom: 8px;
					font-size: 12px;
				}

				.item-name {
					flex: 1;
					font-weight: bold;
				}

				.item-details {
					display: flex;
					justify-content: space-between;
					font-size: 11px;
					color: #666;
					margin-left: 10px;
				}

				.totals {
					margin-top: 15px;
					border-top: 1px dashed #000;
					padding-top: 10px;
				}

				.total-row {
					display: flex;
					justify-content: space-between;
					margin-bottom: 5px;
					font-size: 12px;
				}

				.grand-total {
					font-size: 16px;
					font-weight: bold;
					border-top: 2px solid #000;
					padding-top: 10px;
					margin-top: 10px;
				}

				.payments {
					margin-top: 15px;
					border-top: 1px dashed #000;
					padding-top: 10px;
				}

				.payment-row {
					display: flex;
					justify-content: space-between;
					margin-bottom: 3px;
					font-size: 11px;
				}

				.footer {
					text-align: center;
					margin-top: 20px;
					padding-top: 10px;
					border-top: 2px dashed #000;
					font-size: 11px;
				}

				@media print {
					body {
						padding: 0;
					}

					.no-print {
						display: none;
					}
				}
			</style>
		</head>
		<body>
			<div class="receipt">
				<!-- Header -->
				<div class="header">
					<div class="company-name">${invoiceData.company || 'POS Next'}</div>
					<div style="font-size: 12px;">TAX INVOICE</div>
				</div>

				<!-- Invoice Info -->
				<div class="invoice-info">
					<div>
						<span>Invoice #:</span>
						<span><strong>${invoiceData.name}</strong></span>
					</div>
					<div>
						<span>Date:</span>
						<span>${new Date(invoiceData.posting_date || Date.now()).toLocaleString()}</span>
					</div>
					${invoiceData.customer_name ? `
					<div>
						<span>Customer:</span>
						<span>${invoiceData.customer_name}</span>
					</div>
					` : ''}
				</div>

				<!-- Items -->
				<div class="items-table">
					${invoiceData.items.map(item => `
						<div class="item-row">
							<div style="flex: 1;">
								<div class="item-name">${item.item_name || item.item_code}</div>
								<div class="item-details">
									<span>${item.qty || item.quantity} × ${formatCurrency(item.rate)}</span>
									<span>${formatCurrency(item.amount || (item.rate * (item.qty || item.quantity)))}</span>
								</div>
							</div>
						</div>
					`).join('')}
				</div>

				<!-- Totals -->
				<div class="totals">
					<div class="total-row">
						<span>Subtotal:</span>
						<span>${formatCurrency(invoiceData.subtotal || invoiceData.net_total)}</span>
					</div>
					${invoiceData.discount_amount && invoiceData.discount_amount > 0 ? `
					<div class="total-row" style="color: #28a745;">
						<span>Discount:</span>
						<span>-${formatCurrency(invoiceData.discount_amount)}</span>
					</div>
					` : ''}
					<div class="total-row">
						<span>Tax:</span>
						<span>${formatCurrency(invoiceData.total_taxes_and_charges || 0)}</span>
					</div>
					<div class="total-row grand-total">
						<span>GRAND TOTAL:</span>
						<span>${formatCurrency(invoiceData.grand_total)}</span>
					</div>
				</div>

				<!-- Payments -->
				${invoiceData.payments && invoiceData.payments.length > 0 ? `
				<div class="payments">
					<div style="font-weight: bold; margin-bottom: 5px; font-size: 12px;">Payments:</div>
					${invoiceData.payments.map(payment => `
						<div class="payment-row">
							<span>${payment.mode_of_payment}:</span>
							<span>${formatCurrency(payment.amount)}</span>
						</div>
					`).join('')}
					${invoiceData.change_amount && invoiceData.change_amount > 0 ? `
					<div class="payment-row" style="font-weight: bold; margin-top: 5px;">
						<span>Change:</span>
						<span>${formatCurrency(invoiceData.change_amount)}</span>
					</div>
					` : ''}
				</div>
				` : ''}

				<!-- Footer -->
				<div class="footer">
					<div style="margin-bottom: 5px;">Thank you for your business!</div>
					<div style="font-size: 10px;">Powered by POS Next</div>
				</div>
			</div>

			<div class="no-print" style="text-align: center; margin-top: 20px;">
				<button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer;">
					Print Receipt
				</button>
				<button onclick="window.close()" style="padding: 10px 20px; font-size: 14px; cursor: pointer; margin-left: 10px;">
					Close
				</button>
			</div>
		</body>
		</html>
	`

	printWindow.document.write(printContent)
	printWindow.document.close()

	// Auto print after load
	printWindow.onload = () => {
		setTimeout(() => {
			printWindow.print()
		}, 250)
	}
}

function formatCurrency(amount) {
	return parseFloat(amount || 0).toFixed(2)
}

export async function printInvoiceByName(invoiceName) {
	try {
		const response = await window.frappe.call({
			method: 'frappe.client.get',
			args: {
				doctype: 'Sales Invoice',
				name: invoiceName
			}
		})

		if (response.message) {
			printInvoice(response.message)
		}
	} catch (error) {
		console.error('Error fetching invoice for print:', error)
		throw error
	}
}
