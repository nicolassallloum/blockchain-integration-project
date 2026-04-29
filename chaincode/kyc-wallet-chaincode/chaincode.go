package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

const (
	DocTypeWallet       = "wallet"
	DocTypeOrganization = "organization"
	DocTypeTransaction  = "transaction"

	WalletStatusActive    = "ACTIVE"
	WalletStatusInactive  = "INACTIVE"
	WalletStatusSuspended = "SUSPENDED"

	OrgStatusActive   = "ACTIVE"
	OrgStatusInactive = "INACTIVE"

	TxTypeWalletToWallet       = "WALLET_TO_WALLET"
	TxTypeWalletToOrganization = "WALLET_TO_ORGANIZATION"

	TxStatusSuccess = "SUCCESS"
	TxStatusFailed  = "FAILED"
	TxStatusPending = "PENDING"

	RiskLow    = "LOW"
	RiskMedium = "MEDIUM"
	RiskHigh   = "HIGH"
)

type SmartContract struct {
	contractapi.Contract
}

type Wallet struct {
	DocType            string  `json:"docType"`
	WalletAddress      string  `json:"walletAddress"`
	CustomerID         string  `json:"customerId"`
	OrganizationID     string  `json:"organizationId"`
	WalletPasswordHash string  `json:"walletPasswordHash"`
	Balance            float64 `json:"balance"`
	Currency           string  `json:"currency"`
	Status             string  `json:"status"`
	CreatedAt          string  `json:"createdAt"`
	UpdatedAt          string  `json:"updatedAt"`
	CreatedBy          string  `json:"createdBy"`
	LastLoginAt        string  `json:"lastLoginAt,omitempty"`
}

type Organization struct {
	DocType                   string  `json:"docType"`
	OrganizationID            string  `json:"organizationId"`
	OrganizationName          string  `json:"organizationName"`
	OrganizationWalletAddress string  `json:"organizationWalletAddress"`
	Balance                   float64 `json:"balance"`
	Currency                  string  `json:"currency"`
	Status                    string  `json:"status"`
	CreatedAt                 string  `json:"createdAt"`
	UpdatedAt                 string  `json:"updatedAt"`
}

type Transaction struct {
	DocType           string  `json:"docType"`
	TransactionID     string  `json:"transactionId"`
	TransactionType   string  `json:"transactionType"`
	FromWalletAddress string  `json:"fromWalletAddress"`
	ToWalletAddress   string  `json:"toWalletAddress,omitempty"`
	OrganizationID    string  `json:"organizationId,omitempty"`
	Amount            float64 `json:"amount"`
	Currency          string  `json:"currency"`
	Status            string  `json:"status"`
	RiskLevel         string  `json:"riskLevel"`
	Description       string  `json:"description"`
	CreatedAt         string  `json:"createdAt"`
	CreatedBy         string  `json:"createdBy"`
	FabricTxID        string  `json:"fabricTxId"`
}

type Response struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func walletKey(walletAddress string) string {
	return "WALLET_" + walletAddress
}

func organizationKey(organizationID string) string {
	return "ORG_" + organizationID
}

func transactionKey(transactionID string) string {
	return "TX_" + transactionID
}

func successResponse(message string, data interface{}) (string, error) {
	response := Response{
		Success: true,
		Message: message,
		Data:    data,
	}

	responseBytes, err := json.Marshal(response)
	if err != nil {
		return "", fmt.Errorf("failed to marshal success response: %v", err)
	}

	return string(responseBytes), nil
}

func isBlank(value string) bool {
	return strings.TrimSpace(value) == ""
}

func parsePositiveAmount(amountString string) (float64, error) {
	amount, err := strconv.ParseFloat(amountString, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid amount format")
	}

	if amount <= 0 {
		return 0, fmt.Errorf("amount must be greater than zero")
	}

	return amount, nil
}

func parseNonNegativeAmount(amountString string) (float64, error) {
	amount, err := strconv.ParseFloat(amountString, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid amount format")
	}

	if amount < 0 {
		return 0, fmt.Errorf("amount cannot be negative")
	}

	return amount, nil
}

func isValidRiskLevel(riskLevel string) bool {
	switch strings.ToUpper(riskLevel) {
	case RiskLow, RiskMedium, RiskHigh:
		return true
	default:
		return false
	}
}

func isValidStatus(status string) bool {
	switch strings.ToUpper(status) {
	case TxStatusSuccess, TxStatusFailed, TxStatusPending:
		return true
	default:
		return false
	}
}

func isValidTransactionType(txType string) bool {
	switch strings.ToUpper(txType) {
	case TxTypeWalletToWallet, TxTypeWalletToOrganization:
		return true
	default:
		return false
	}
}

func (s *SmartContract) walletExists(ctx contractapi.TransactionContextInterface, walletAddress string) (bool, error) {
	walletBytes, err := ctx.GetStub().GetState(walletKey(walletAddress))
	if err != nil {
		return false, fmt.Errorf("failed to read wallet from ledger: %v", err)
	}

	return walletBytes != nil, nil
}

func (s *SmartContract) transactionExists(ctx contractapi.TransactionContextInterface, transactionID string) (bool, error) {
	txBytes, err := ctx.GetStub().GetState(transactionKey(transactionID))
	if err != nil {
		return false, fmt.Errorf("failed to read transaction from ledger: %v", err)
	}

	return txBytes != nil, nil
}

func (s *SmartContract) getWallet(ctx contractapi.TransactionContextInterface, walletAddress string) (*Wallet, error) {
	walletBytes, err := ctx.GetStub().GetState(walletKey(walletAddress))
	if err != nil {
		return nil, fmt.Errorf("failed to read wallet from ledger: %v", err)
	}

	if walletBytes == nil {
		return nil, fmt.Errorf("wallet not found")
	}

	var wallet Wallet
	err = json.Unmarshal(walletBytes, &wallet)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal wallet data: %v", err)
	}

	return &wallet, nil
}

func (s *SmartContract) getOrganization(ctx contractapi.TransactionContextInterface, organizationID string) (*Organization, error) {
	orgBytes, err := ctx.GetStub().GetState(organizationKey(organizationID))
	if err != nil {
		return nil, fmt.Errorf("failed to read organization from ledger: %v", err)
	}

	if orgBytes == nil {
		return nil, fmt.Errorf("organization not found")
	}

	var organization Organization
	err = json.Unmarshal(orgBytes, &organization)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal organization data: %v", err)
	}

	return &organization, nil
}

func (s *SmartContract) putWallet(ctx contractapi.TransactionContextInterface, wallet *Wallet) error {
	walletBytes, err := json.Marshal(wallet)
	if err != nil {
		return fmt.Errorf("failed to marshal wallet: %v", err)
	}

	err = ctx.GetStub().PutState(walletKey(wallet.WalletAddress), walletBytes)
	if err != nil {
		return fmt.Errorf("failed to write wallet to ledger: %v", err)
	}

	return nil
}

func (s *SmartContract) putOrganization(ctx contractapi.TransactionContextInterface, organization *Organization) error {
	orgBytes, err := json.Marshal(organization)
	if err != nil {
		return fmt.Errorf("failed to marshal organization: %v", err)
	}

	err = ctx.GetStub().PutState(organizationKey(organization.OrganizationID), orgBytes)
	if err != nil {
		return fmt.Errorf("failed to write organization to ledger: %v", err)
	}

	return nil
}

func (s *SmartContract) putTransaction(ctx contractapi.TransactionContextInterface, transaction *Transaction) error {
	txBytes, err := json.Marshal(transaction)
	if err != nil {
		return fmt.Errorf("failed to marshal transaction: %v", err)
	}

	err = ctx.GetStub().PutState(transactionKey(transaction.TransactionID), txBytes)
	if err != nil {
		return fmt.Errorf("failed to write transaction to ledger: %v", err)
	}

	return nil
}

// CreateWallet creates a new wallet on the ledger.
func (s *SmartContract) CreateWallet(
	ctx contractapi.TransactionContextInterface,
	walletAddress string,
	customerID string,
	organizationID string,
	walletPasswordHash string,
	initialBalanceString string,
	currency string,
	createdBy string,
	createdAt string,
) (string, error) {

	if isBlank(walletAddress) {
		return "", fmt.Errorf("walletAddress is required")
	}

	if isBlank(customerID) {
		return "", fmt.Errorf("customerId is required")
	}

	if isBlank(organizationID) {
		return "", fmt.Errorf("organizationId is required")
	}

	if isBlank(walletPasswordHash) {
		return "", fmt.Errorf("walletPasswordHash is required")
	}

	if isBlank(currency) {
		return "", fmt.Errorf("currency is required")
	}

	if isBlank(createdBy) {
		return "", fmt.Errorf("createdBy is required")
	}

	if isBlank(createdAt) {
		return "", fmt.Errorf("createdAt is required")
	}

	initialBalance, err := parseNonNegativeAmount(initialBalanceString)
	if err != nil {
		return "", err
	}

	exists, err := s.walletExists(ctx, walletAddress)
	if err != nil {
		return "", err
	}

	if exists {
		return "", fmt.Errorf("wallet already exists")
	}

	wallet := Wallet{
		DocType:            DocTypeWallet,
		WalletAddress:      walletAddress,
		CustomerID:         customerID,
		OrganizationID:     organizationID,
		WalletPasswordHash: walletPasswordHash,
		Balance:            initialBalance,
		Currency:           strings.ToUpper(currency),
		Status:             WalletStatusActive,
		CreatedAt:          createdAt,
		UpdatedAt:          createdAt,
		CreatedBy:          createdBy,
	}

	err = s.putWallet(ctx, &wallet)
	if err != nil {
		return "", err
	}

	wallet.WalletPasswordHash = ""

	return successResponse("Wallet created successfully", wallet)
}

// LoginWallet validates wallet login credentials using a pre-hashed password.
func (s *SmartContract) LoginWallet(
	ctx contractapi.TransactionContextInterface,
	walletAddress string,
	walletPasswordHash string,
	loginAt string,
) (string, error) {

	if isBlank(walletAddress) {
		return "", fmt.Errorf("walletAddress is required")
	}

	if isBlank(walletPasswordHash) {
		return "", fmt.Errorf("walletPasswordHash is required")
	}

	if isBlank(loginAt) {
		return "", fmt.Errorf("loginAt is required")
	}

	wallet, err := s.getWallet(ctx, walletAddress)
	if err != nil {
		return "", err
	}

	if wallet.Status != WalletStatusActive {
		return "", fmt.Errorf("wallet is not active")
	}

	if wallet.WalletPasswordHash != walletPasswordHash {
		return "", fmt.Errorf("invalid wallet credentials")
	}

	wallet.LastLoginAt = loginAt
	wallet.UpdatedAt = loginAt

	err = s.putWallet(ctx, wallet)
	if err != nil {
		return "", err
	}

	wallet.WalletPasswordHash = ""

	return successResponse("Wallet login validated successfully", wallet)
}

// TransferBetweenWallets transfers balance from one wallet to another wallet.
func (s *SmartContract) TransferBetweenWallets(
	ctx contractapi.TransactionContextInterface,
	transactionID string,
	fromWalletAddress string,
	toWalletAddress string,
	amountString string,
	currency string,
	description string,
	riskLevel string,
	createdBy string,
	createdAt string,
) (string, error) {

	if isBlank(transactionID) {
		return "", fmt.Errorf("transactionId is required")
	}

	if isBlank(fromWalletAddress) {
		return "", fmt.Errorf("fromWalletAddress is required")
	}

	if isBlank(toWalletAddress) {
		return "", fmt.Errorf("toWalletAddress is required")
	}

	if fromWalletAddress == toWalletAddress {
		return "", fmt.Errorf("sender and receiver wallets cannot be the same")
	}

	if isBlank(currency) {
		return "", fmt.Errorf("currency is required")
	}

	if isBlank(riskLevel) {
		return "", fmt.Errorf("riskLevel is required")
	}

	if !isValidRiskLevel(riskLevel) {
		return "", fmt.Errorf("invalid riskLevel")
	}

	if strings.ToUpper(riskLevel) == RiskHigh {
		return "", fmt.Errorf("high-risk transfers are blocked until maker-checker is implemented")
	}

	if isBlank(createdBy) {
		return "", fmt.Errorf("createdBy is required")
	}

	if isBlank(createdAt) {
		return "", fmt.Errorf("createdAt is required")
	}

	amount, err := parsePositiveAmount(amountString)
	if err != nil {
		return "", err
	}

	txExists, err := s.transactionExists(ctx, transactionID)
	if err != nil {
		return "", err
	}

	if txExists {
		return "", fmt.Errorf("transaction already exists")
	}

	senderWallet, err := s.getWallet(ctx, fromWalletAddress)
	if err != nil {
		return "", fmt.Errorf("sender wallet not found")
	}

	receiverWallet, err := s.getWallet(ctx, toWalletAddress)
	if err != nil {
		return "", fmt.Errorf("receiver wallet not found")
	}

	if senderWallet.Status != WalletStatusActive {
		return "", fmt.Errorf("sender wallet is not active")
	}

	if receiverWallet.Status != WalletStatusActive {
		return "", fmt.Errorf("receiver wallet is not active")
	}

	if senderWallet.Currency != strings.ToUpper(currency) || receiverWallet.Currency != strings.ToUpper(currency) {
		return "", fmt.Errorf("currency mismatch between wallets")
	}

	if senderWallet.Balance < amount {
		return "", fmt.Errorf("insufficient wallet balance")
	}

	senderWallet.Balance = senderWallet.Balance - amount
	receiverWallet.Balance = receiverWallet.Balance + amount

	senderWallet.UpdatedAt = createdAt
	receiverWallet.UpdatedAt = createdAt

	transaction := Transaction{
		DocType:           DocTypeTransaction,
		TransactionID:     transactionID,
		TransactionType:   TxTypeWalletToWallet,
		FromWalletAddress: fromWalletAddress,
		ToWalletAddress:   toWalletAddress,
		Amount:            amount,
		Currency:          strings.ToUpper(currency),
		Status:            TxStatusSuccess,
		RiskLevel:         strings.ToUpper(riskLevel),
		Description:       description,
		CreatedAt:         createdAt,
		CreatedBy:         createdBy,
		FabricTxID:        ctx.GetStub().GetTxID(),
	}

	err = s.putWallet(ctx, senderWallet)
	if err != nil {
		return "", err
	}

	err = s.putWallet(ctx, receiverWallet)
	if err != nil {
		return "", err
	}

	err = s.putTransaction(ctx, &transaction)
	if err != nil {
		return "", err
	}

	result := map[string]interface{}{
		"transaction":        transaction,
		"senderNewBalance":   senderWallet.Balance,
		"receiverNewBalance": receiverWallet.Balance,
	}

	return successResponse("Transfer completed successfully", result)
}

// TransferToOrganization transfers balance from wallet to organization.
func (s *SmartContract) TransferToOrganization(
	ctx contractapi.TransactionContextInterface,
	transactionID string,
	fromWalletAddress string,
	organizationID string,
	amountString string,
	currency string,
	description string,
	riskLevel string,
	createdBy string,
	createdAt string,
) (string, error) {

	if isBlank(transactionID) {
		return "", fmt.Errorf("transactionId is required")
	}

	if isBlank(fromWalletAddress) {
		return "", fmt.Errorf("fromWalletAddress is required")
	}

	if isBlank(organizationID) {
		return "", fmt.Errorf("organizationId is required")
	}

	if isBlank(currency) {
		return "", fmt.Errorf("currency is required")
	}

	if isBlank(riskLevel) {
		return "", fmt.Errorf("riskLevel is required")
	}

	if !isValidRiskLevel(riskLevel) {
		return "", fmt.Errorf("invalid riskLevel")
	}

	if strings.ToUpper(riskLevel) == RiskHigh {
		return "", fmt.Errorf("high-risk organization transfers are blocked until maker-checker is implemented")
	}

	if isBlank(createdBy) {
		return "", fmt.Errorf("createdBy is required")
	}

	if isBlank(createdAt) {
		return "", fmt.Errorf("createdAt is required")
	}

	amount, err := parsePositiveAmount(amountString)
	if err != nil {
		return "", err
	}

	txExists, err := s.transactionExists(ctx, transactionID)
	if err != nil {
		return "", err
	}

	if txExists {
		return "", fmt.Errorf("transaction already exists")
	}

	wallet, err := s.getWallet(ctx, fromWalletAddress)
	if err != nil {
		return "", fmt.Errorf("wallet not found")
	}

	organization, err := s.getOrganization(ctx, organizationID)
	if err != nil {
		return "", err
	}

	if wallet.Status != WalletStatusActive {
		return "", fmt.Errorf("wallet is not active")
	}

	if organization.Status != OrgStatusActive {
		return "", fmt.Errorf("organization is not active")
	}

	if wallet.Currency != strings.ToUpper(currency) || organization.Currency != strings.ToUpper(currency) {
		return "", fmt.Errorf("currency mismatch")
	}

	if wallet.Balance < amount {
		return "", fmt.Errorf("insufficient wallet balance")
	}

	wallet.Balance = wallet.Balance - amount
	organization.Balance = organization.Balance + amount

	wallet.UpdatedAt = createdAt
	organization.UpdatedAt = createdAt

	transaction := Transaction{
		DocType:           DocTypeTransaction,
		TransactionID:     transactionID,
		TransactionType:   TxTypeWalletToOrganization,
		FromWalletAddress: fromWalletAddress,
		OrganizationID:    organizationID,
		Amount:            amount,
		Currency:          strings.ToUpper(currency),
		Status:            TxStatusSuccess,
		RiskLevel:         strings.ToUpper(riskLevel),
		Description:       description,
		CreatedAt:         createdAt,
		CreatedBy:         createdBy,
		FabricTxID:        ctx.GetStub().GetTxID(),
	}

	err = s.putWallet(ctx, wallet)
	if err != nil {
		return "", err
	}

	err = s.putOrganization(ctx, organization)
	if err != nil {
		return "", err
	}

	err = s.putTransaction(ctx, &transaction)
	if err != nil {
		return "", err
	}

	result := map[string]interface{}{
		"transaction":            transaction,
		"walletNewBalance":       wallet.Balance,
		"organizationNewBalance": organization.Balance,
	}

	return successResponse("Organization transfer completed successfully", result)
}

// GetWalletBalance returns current wallet balance.
func (s *SmartContract) GetWalletBalance(
	ctx contractapi.TransactionContextInterface,
	walletAddress string,
) (string, error) {

	if isBlank(walletAddress) {
		return "", fmt.Errorf("walletAddress is required")
	}

	wallet, err := s.getWallet(ctx, walletAddress)
	if err != nil {
		return "", err
	}

	wallet.WalletPasswordHash = ""

	result := map[string]interface{}{
		"walletAddress":  wallet.WalletAddress,
		"customerId":     wallet.CustomerID,
		"organizationId": wallet.OrganizationID,
		"balance":        wallet.Balance,
		"currency":       wallet.Currency,
		"status":         wallet.Status,
		"updatedAt":      wallet.UpdatedAt,
	}

	return successResponse("Wallet balance retrieved successfully", result)
}

// GetTransactionHistory returns wallet or organization transaction history using CouchDB rich query.
func (s *SmartContract) GetTransactionHistory(
	ctx contractapi.TransactionContextInterface,
	entityType string,
	entityID string,
	fromDate string,
	toDate string,
	transactionType string,
	status string,
	limitString string,
) (string, error) {

	if isBlank(entityType) {
		return "", fmt.Errorf("entityType is required")
	}

	if isBlank(entityID) {
		return "", fmt.Errorf("entityId is required")
	}

	entityType = strings.ToUpper(entityType)
	transactionType = strings.ToUpper(transactionType)
	status = strings.ToUpper(status)

	if entityType != "WALLET" && entityType != "ORGANIZATION" {
		return "", fmt.Errorf("entityType must be WALLET or ORGANIZATION")
	}

	if transactionType != "" && transactionType != "ALL" && !isValidTransactionType(transactionType) {
		return "", fmt.Errorf("invalid transactionType")
	}

	if status != "" && status != "ALL" && !isValidStatus(status) {
		return "", fmt.Errorf("invalid status")
	}

	limit := 50
	if !isBlank(limitString) {
		parsedLimit, err := strconv.Atoi(limitString)
		if err != nil {
			return "", fmt.Errorf("invalid query limit")
		}

		if parsedLimit <= 0 || parsedLimit > 500 {
			return "", fmt.Errorf("query limit must be between 1 and 500")
		}

		limit = parsedLimit
	}

	selector := map[string]interface{}{
		"docType": DocTypeTransaction,
	}

	if entityType == "WALLET" {
		selector["$or"] = []map[string]interface{}{
			{
				"fromWalletAddress": entityID,
			},
			{
				"toWalletAddress": entityID,
			},
		}
	} else {
		selector["organizationId"] = entityID
	}

	if transactionType != "" && transactionType != "ALL" {
		selector["transactionType"] = transactionType
	}

	if status != "" && status != "ALL" {
		selector["status"] = status
	}

	dateFilter := map[string]interface{}{}

	if !isBlank(fromDate) && strings.ToUpper(fromDate) != "ALL" {
		dateFilter["$gte"] = fromDate
	}

	if !isBlank(toDate) && strings.ToUpper(toDate) != "ALL" {
		dateFilter["$lte"] = toDate
	}

	if len(dateFilter) > 0 {
		selector["createdAt"] = dateFilter
	}

	query := map[string]interface{}{
		"selector": selector,
		"limit":    limit,
	}

	queryBytes, err := json.Marshal(query)
	if err != nil {
		return "", fmt.Errorf("failed to build transaction history query: %v", err)
	}

	resultsIterator, err := ctx.GetStub().GetQueryResult(string(queryBytes))
	if err != nil {
		return "", fmt.Errorf("failed to retrieve transaction history: %v", err)
	}
	defer resultsIterator.Close()

	transactions := []Transaction{}

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return "", fmt.Errorf("failed to iterate transaction history: %v", err)
		}

		var transaction Transaction
		err = json.Unmarshal(queryResponse.Value, &transaction)
		if err != nil {
			return "", fmt.Errorf("failed to unmarshal transaction history record: %v", err)
		}

		transactions = append(transactions, transaction)
	}

	result := map[string]interface{}{
		"entityType":      entityType,
		"entityId":        entityID,
		"totalReturned":   len(transactions),
		"transactions":    transactions,
		"queryLimit":      limit,
		"transactionType": transactionType,
		"status":          status,
	}

	return successResponse("Transaction history retrieved successfully", result)
}

// CreateOrganization is a setup/helper function used to create organization records for testing and production initialization.
func (s *SmartContract) CreateOrganization(
	ctx contractapi.TransactionContextInterface,
	organizationID string,
	organizationName string,
	organizationWalletAddress string,
	initialBalanceString string,
	currency string,
	createdAt string,
) (string, error) {

	if isBlank(organizationID) {
		return "", fmt.Errorf("organizationId is required")
	}

	if isBlank(organizationName) {
		return "", fmt.Errorf("organizationName is required")
	}

	if isBlank(organizationWalletAddress) {
		return "", fmt.Errorf("organizationWalletAddress is required")
	}

	if isBlank(currency) {
		return "", fmt.Errorf("currency is required")
	}

	if isBlank(createdAt) {
		return "", fmt.Errorf("createdAt is required")
	}

	initialBalance, err := parseNonNegativeAmount(initialBalanceString)
	if err != nil {
		return "", err
	}

	existingOrgBytes, err := ctx.GetStub().GetState(organizationKey(organizationID))
	if err != nil {
		return "", fmt.Errorf("failed to check organization existence: %v", err)
	}

	if existingOrgBytes != nil {
		return "", fmt.Errorf("organization already exists")
	}

	organization := Organization{
		DocType:                   DocTypeOrganization,
		OrganizationID:            organizationID,
		OrganizationName:          organizationName,
		OrganizationWalletAddress: organizationWalletAddress,
		Balance:                   initialBalance,
		Currency:                  strings.ToUpper(currency),
		Status:                    OrgStatusActive,
		CreatedAt:                 createdAt,
		UpdatedAt:                 createdAt,
	}

	err = s.putOrganization(ctx, &organization)
	if err != nil {
		return "", err
	}

	return successResponse("Organization created successfully", organization)
}

func main() {
	chaincode, err := contractapi.NewChaincode(new(SmartContract))
	if err != nil {
		panic(fmt.Sprintf("failed to create chaincode: %v", err))
	}

	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("failed to start chaincode: %v", err))
	}
}
